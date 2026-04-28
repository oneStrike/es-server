import type { Db, DrizzleMutationResult } from '@db/core'
import type { ForumModeratorApplicationSelect } from '@db/schema'
import { buildILikeCondition, DrizzleService } from '@db/core'

import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, SQL } from 'drizzle-orm'
import {
  AuditForumModeratorApplicationDto,
  CreateForumModeratorApplicationDto,
  QueryForumModeratorApplicationDto,
} from './dto/moderator-application.dto'
import { ForumModeratorApplicationStatusEnum } from './moderator-application.constant'
import {
  ALL_FORUM_MODERATOR_PERMISSIONS,
  FORUM_MODERATOR_PERMISSION_LABELS,
  ForumModeratorPermissionEnum,
} from './moderator.constant'
import { ForumModeratorService } from './moderator.service'

/**
 * 论坛版主申请服务。
 * 负责用户申请、后台审核以及申请详情/分页视图装配，并与版主服务协同完成审批落库。
 */
@Injectable()
export class ForumModeratorApplicationService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumModeratorService: ForumModeratorService,
  ) {}

  /** 统一复用当前模块的 Drizzle 数据库实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** forum_moderator_application 表访问入口。 */
  private get forumModeratorApplication() {
    return this.drizzle.schema.forumModeratorApplication
  }

  /**
   * 归一化申请权限数组。
   * 仅保留系统支持的权限值，防止重复值或非法值进入审核与授权路径。
   */
  private normalizePermissions(
    permissions?: Array<number | null | undefined> | null,
  ) {
    const normalized = new Set<ForumModeratorPermissionEnum>()

    for (const permission of permissions ?? []) {
      if (
        Number.isInteger(permission) &&
        ALL_FORUM_MODERATOR_PERMISSIONS.includes(
          permission as ForumModeratorPermissionEnum,
        )
      ) {
        normalized.add(permission as ForumModeratorPermissionEnum)
      }
    }

    return ALL_FORUM_MODERATOR_PERMISSIONS.filter((permission) =>
      normalized.has(permission),
    )
  }

  /**
   * 将权限值映射为可读文案。
   * 仅用于详情与列表响应，不参与审核通过时的权限裁剪判断。
   */
  private getPermissionNames(permissions: ForumModeratorPermissionEnum[]) {
    return permissions.map(
      (permission) => FORUM_MODERATOR_PERMISSION_LABELS[permission],
    )
  }

  /**
   * 校验申请用户存在且未软删除。
   * 在创建申请前提前失败，避免写路径产生指向无效用户的申请单。
   */
  private async ensureApplicantExists(
    applicantId: number,
    client: Db = this.db,
  ) {
    const user = await client.query.appUser.findFirst({
      where: {
        id: applicantId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '申请用户不存在',
      )
    }
  }

  /**
   * 校验申请板块存在且仍处于启用状态。
   * 禁止用户对已删除或已禁用板块继续发起版主申请。
   */
  private async ensureSectionExists(sectionId: number, client: Db = this.db) {
    const section = await client.query.forumSection.findFirst({
      where: {
        id: sectionId,
        deletedAt: { isNull: true },
        isEnabled: true,
      },
      columns: { id: true },
    })

    if (!section) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '申请板块不存在或已禁用',
      )
    }
  }

  /**
   * 校验申请用户当前不是有效版主。
   * 审核通过和创建申请都会复用该约束，避免重复授予版主身份。
   */
  private async ensureUserNotModerator(
    applicantId: number,
    client: Db = this.db,
  ) {
    const moderator = await client.query.forumModerator.findFirst({
      where: {
        userId: applicantId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (moderator) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
        '当前用户已是版主，无需重复申请',
      )
    }
  }

  /**
   * 将 0 行更新统一收口为稳定业务异常。
   * 用于申请审核这类先读后写链路，避免并发下静默失败。
   */
  private assertAffectedRows(result: DrizzleMutationResult, message: string) {
    this.drizzle.assertAffectedRows(result, message)
  }

  /**
   * 批量装配版主申请视图。
   * 统一补齐申请人、审核人、板块和权限名称，避免 controller 层再做拼装。
   */
  private async buildApplicationViews(rows: ForumModeratorApplicationSelect[]) {
    if (rows.length === 0) {
      return []
    }

    const applicantIds = [...new Set(rows.map((item) => item.applicantId))]
    const auditorIds = [
      ...new Set(
        rows
          .map((item) => item.auditById)
          .filter((item): item is number => item !== null),
      ),
    ]
    const sectionIds = [...new Set(rows.map((item) => item.sectionId))]

    const [applicants, auditors, sections] = await Promise.all([
      this.db.query.appUser.findMany({
        where: { id: { in: applicantIds } },
        columns: {
          id: true,
          nickname: true,
          avatarUrl: true,
        },
      }),
      auditorIds.length > 0
        ? this.db.query.appUser.findMany({
            where: { id: { in: auditorIds } },
            columns: {
              id: true,
              nickname: true,
              avatarUrl: true,
            },
          })
        : Promise.resolve([]),
      this.db.query.forumSection.findMany({
        where: { id: { in: sectionIds } },
        columns: {
          id: true,
          name: true,
          description: true,
          icon: true,
          cover: true,
        },
      }),
    ])

    const applicantMap = new Map<number, (typeof applicants)[number]>(
      applicants.map((item) => [item.id, item] as const),
    )
    const auditorMap = new Map<number, (typeof auditors)[number]>(
      auditors.map((item) => [item.id, item] as const),
    )
    const sectionMap = new Map<number, (typeof sections)[number]>(
      sections.map((item) => [item.id, item] as const),
    )

    return rows.map((row) => {
      const permissions = this.normalizePermissions(row.permissions)

      return {
        ...row,
        permissions,
        permissionNames: this.getPermissionNames(permissions),
        applicant: applicantMap.get(row.applicantId),
        auditor: row.auditById ? auditorMap.get(row.auditById) : undefined,
        section: sectionMap.get(row.sectionId),
      }
    })
  }

  /**
   * 查询后台版主申请详情。
   * 仅返回未软删除记录，缺失时抛出稳定的 not-found 异常。
   */
  async getApplicationDetail(id: number) {
    const application = await this.db.query.forumModeratorApplication.findFirst(
      {
        where: {
          id,
          deletedAt: { isNull: true },
        },
      },
    )

    if (!application) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '版主申请不存在',
      )
    }

    const [detail] = await this.buildApplicationViews([application])
    return detail
  }

  /**
   * 查询当前用户的版主申请详情。
   * 通过 applicantId 绑定当前用户，避免越权读取他人申请单。
   */
  async getMyApplicationDetail(userId: number, id: number) {
    const application = await this.db.query.forumModeratorApplication.findFirst(
      {
        where: {
          id,
          applicantId: userId,
          deletedAt: { isNull: true },
        },
      },
    )

    if (!application) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '版主申请不存在',
      )
    }

    const [detail] = await this.buildApplicationViews([application])
    return detail
  }

  /**
   * 提交版主申请。
   * 对同一用户同一板块的历史申请会复用原记录并重置为待审核状态，避免重复插入脏数据。
   */
  async createApplication(
    applicantId: number,
    input: CreateForumModeratorApplicationDto,
  ) {
    await this.ensureApplicantExists(applicantId)
    await this.ensureUserNotModerator(applicantId)
    await this.ensureSectionExists(input.sectionId)

    const permissions = this.normalizePermissions(input.permissions)
    if (permissions.length === 0) {
      throw new BadRequestException('申请权限不能为空')
    }

    const existing = await this.db.query.forumModeratorApplication.findFirst({
      where: {
        applicantId,
        sectionId: input.sectionId,
      },
    })

    if (
      existing &&
      existing.deletedAt === null &&
      existing.status === ForumModeratorApplicationStatusEnum.PENDING
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前板块已有待审核申请',
      )
    }

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        if (existing) {
          const result = await tx
            .update(this.forumModeratorApplication)
            .set({
              status: ForumModeratorApplicationStatusEnum.PENDING,
              permissions,
              reason: input.reason,
              auditReason: null,
              remark: input.remark,
              auditById: null,
              auditAt: null,
              deletedAt: null,
            })
            .where(eq(this.forumModeratorApplication.id, existing.id))
          this.drizzle.assertAffectedRows(result, '版主申请不存在')
          return true
        }

        await tx.insert(this.forumModeratorApplication).values({
          applicantId,
          sectionId: input.sectionId,
          status: ForumModeratorApplicationStatusEnum.PENDING,
          permissions,
          reason: input.reason,
          remark: input.remark,
        })
        return true
      }),
    )

    return true
  }

  /**
   * 分页查询版主申请。
   * nickname 过滤会先解析用户集合，再收敛到申请表，保证申请列表与用户昵称搜索口径一致。
   */
  async getApplicationPage(query: QueryForumModeratorApplicationDto) {
    const { nickname, ...pagination } = query
    const conditions: SQL[] = []

    if (query.applicantId !== undefined) {
      conditions.push(
        eq(this.forumModeratorApplication.applicantId, query.applicantId),
      )
    }
    if (query.sectionId !== undefined) {
      conditions.push(
        eq(this.forumModeratorApplication.sectionId, query.sectionId),
      )
    }
    if (query.status !== undefined) {
      conditions.push(eq(this.forumModeratorApplication.status, query.status))
    }
    conditions.push(isNull(this.forumModeratorApplication.deletedAt))

    if (nickname) {
      const users = await this.db
        .select({ id: this.drizzle.schema.appUser.id })
        .from(this.drizzle.schema.appUser)
        .where(
          buildILikeCondition(this.drizzle.schema.appUser.nickname, nickname),
        )
      const userIds = users.map((item) => item.id)

      conditions.push(
        userIds.length > 0
          ? inArray(this.forumModeratorApplication.applicantId, userIds)
          : eq(this.forumModeratorApplication.id, -1),
      )
    }

    const page = await this.drizzle.ext.findPagination(
      this.forumModeratorApplication,
      {
        where: conditions.length > 0 ? and(...conditions) : undefined,
        ...pagination,
        orderBy: [{ createdAt: 'desc' }],
      },
    )

    return {
      ...page,
      list: await this.buildApplicationViews(page.list),
    }
  }

  /**
   * 分页查询当前用户的申请记录。
   * 在通用分页查询基础上强制追加 applicantId 约束，避免出现双份实现。
   */
  async getMyApplicationPage(
    applicantId: number,
    query: QueryForumModeratorApplicationDto,
  ) {
    return this.getApplicationPage({
      ...query,
      applicantId,
    })
  }

  /**
   * 审核版主申请。
   * 审核通过时会先校验板块与用户状态，再调用版主服务授予板块版主身份，最后落审核结果。
   */
  async auditApplication(
    auditorId: number,
    input: AuditForumModeratorApplicationDto,
  ) {
    if (input.status === ForumModeratorApplicationStatusEnum.PENDING) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '审核结果不能为待审核',
      )
    }

    const application = await this.db.query.forumModeratorApplication.findFirst(
      {
        where: {
          id: input.id,
          deletedAt: { isNull: true },
        },
      },
    )

    if (!application) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '版主申请不存在',
      )
    }

    if (application.status !== ForumModeratorApplicationStatusEnum.PENDING) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '该申请已处理，请勿重复审核',
      )
    }

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        if (input.status === ForumModeratorApplicationStatusEnum.APPROVED) {
          await this.ensureSectionExists(application.sectionId, tx)
          await this.ensureUserNotModerator(application.applicantId, tx)
          await this.forumModeratorService.createSectionModeratorFromApplication(
            {
              userId: application.applicantId,
              sectionId: application.sectionId,
              permissions: this.normalizePermissions(application.permissions),
            },
            tx,
          )
        }

        const result = await tx
          .update(this.forumModeratorApplication)
          .set({
            status: input.status,
            auditById: auditorId,
            auditReason: input.auditReason,
            remark: input.remark ?? application.remark,
            auditAt: new Date(),
          })
          .where(
            and(
              eq(this.forumModeratorApplication.id, input.id),
              eq(
                this.forumModeratorApplication.status,
                ForumModeratorApplicationStatusEnum.PENDING,
              ),
              isNull(this.forumModeratorApplication.deletedAt),
            ),
          )

        this.assertAffectedRows(result, '版主申请不存在或已处理')
      }),
    )

    return true
  }

  /**
   * 后台软删除版主申请。
   * 仅对未软删除记录生效，并通过受影响行数统一抛出缺失异常。
   */
  async deleteApplication(id: number) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.forumModeratorApplication)
          .set({
            deletedAt: new Date(),
          })
          .where(
            and(
              eq(this.forumModeratorApplication.id, id),
              isNull(this.forumModeratorApplication.deletedAt),
            ),
          ),
      { notFound: '版主申请不存在' },
    )
    return true
  }

  /**
   * 用户删除自己的版主申请。
   * 删除条件会同时绑定 applicantId，防止用户删除他人申请单。
   */
  async deleteMyApplication(userId: number, id: number) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.forumModeratorApplication)
          .set({
            deletedAt: new Date(),
          })
          .where(
            and(
              eq(this.forumModeratorApplication.id, id),
              eq(this.forumModeratorApplication.applicantId, userId),
              isNull(this.forumModeratorApplication.deletedAt),
            ),
          ),
      { notFound: '版主申请不存在' },
    )
    return true
  }
}
