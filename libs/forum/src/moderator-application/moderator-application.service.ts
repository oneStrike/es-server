import type { ForumModeratorApplication } from '@db/schema'
import type {
  AuditForumModeratorApplicationInput,
  CreateForumModeratorApplicationInput,
  QueryForumModeratorApplicationInput,
} from './moderator-application.type'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, ilike, inArray, isNull, SQL } from 'drizzle-orm'
import {
  ALL_FORUM_MODERATOR_PERMISSIONS,
  FORUM_MODERATOR_PERMISSION_LABELS,
  ForumModeratorPermissionEnum,
  ForumModeratorService,
} from '../moderator'
import { ForumModeratorApplicationStatusEnum } from './moderator-application.constant'

/**
 * 论坛版主申请服务。
 * 提供用户申请、后台审核与分页查询能力。
 */
@Injectable()
export class ForumModeratorApplicationService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumModeratorService: ForumModeratorService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get forumModeratorApplication() {
    return this.drizzle.schema.forumModeratorApplication
  }

  private normalizePermissions(
    permissions?: Array<number | string | null | undefined> | null,
  ): ForumModeratorPermissionEnum[] {
    const normalized = new Set<ForumModeratorPermissionEnum>()

    for (const permission of permissions ?? []) {
      const parsed =
        typeof permission === 'number'
          ? permission
          : Number.parseInt(String(permission), 10)

      if (
        Number.isInteger(parsed) &&
        ALL_FORUM_MODERATOR_PERMISSIONS.includes(
          parsed as ForumModeratorPermissionEnum,
        )
      ) {
        normalized.add(parsed as ForumModeratorPermissionEnum)
      }
    }

    return ALL_FORUM_MODERATOR_PERMISSIONS.filter((permission) =>
      normalized.has(permission),
    )
  }

  private getPermissionNames(permissions: ForumModeratorPermissionEnum[]) {
    return permissions.map(
      (permission) => FORUM_MODERATOR_PERMISSION_LABELS[permission],
    )
  }

  private async ensureApplicantExists(applicantId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: {
        id: applicantId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!user) {
      throw new BadRequestException('申请用户不存在')
    }
  }

  private async ensureSectionExists(sectionId: number) {
    const section = await this.db.query.forumSection.findFirst({
      where: {
        id: sectionId,
        deletedAt: { isNull: true },
        isEnabled: true,
      },
      columns: { id: true },
    })

    if (!section) {
      throw new BadRequestException('申请板块不存在或已禁用')
    }
  }

  private async ensureUserNotModerator(applicantId: number) {
    const moderator = await this.db.query.forumModerator.findFirst({
      where: {
        userId: applicantId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (moderator) {
      throw new BadRequestException('当前用户已是版主，无需重复申请')
    }
  }

  private async buildApplicationViews(
    rows: ForumModeratorApplication[],
  ) {
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

  async getApplicationDetail(id: number) {
    const application = await this.db.query.forumModeratorApplication.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })

    if (!application) {
      throw new NotFoundException('版主申请不存在')
    }

    const [detail] = await this.buildApplicationViews([application])
    return detail
  }

  async getMyApplicationDetail(userId: number, id: number) {
    const application = await this.db.query.forumModeratorApplication.findFirst({
      where: {
        id,
        applicantId: userId,
        deletedAt: { isNull: true },
      },
    })

    if (!application) {
      throw new NotFoundException('版主申请不存在')
    }

    const [detail] = await this.buildApplicationViews([application])
    return detail
  }

  async createApplication(
    applicantId: number,
    input: CreateForumModeratorApplicationInput,
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
      throw new BadRequestException('当前板块已有待审核申请')
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

        await tx
          .insert(this.forumModeratorApplication)
          .values({
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

  async getApplicationPage(query: QueryForumModeratorApplicationInput) {
    const { nickname, ...pagination } = query
    const conditions: SQL[] = []

    const baseWhere = this.drizzle.buildWhere(this.forumModeratorApplication, {
      and: {
        applicantId: query.applicantId,
        sectionId: query.sectionId,
        status: query.status,
        deletedAt: { isNull: true },
      },
    })

    if (baseWhere) {
      conditions.push(baseWhere)
    }

    if (nickname) {
      const users = await this.db
        .select({ id: this.drizzle.schema.appUser.id })
        .from(this.drizzle.schema.appUser)
        .where(ilike(this.drizzle.schema.appUser.nickname, `%${nickname}%`))
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

  async getMyApplicationPage(
    applicantId: number,
    query: QueryForumModeratorApplicationInput,
  ) {
    return this.getApplicationPage({
      ...query,
      applicantId,
    })
  }

  async auditApplication(
    auditorId: number,
    input: AuditForumModeratorApplicationInput,
  ) {
    if (input.status === ForumModeratorApplicationStatusEnum.PENDING) {
      throw new BadRequestException('审核结果不能为待审核')
    }

    const application = await this.db.query.forumModeratorApplication.findFirst({
      where: {
        id: input.id,
        deletedAt: { isNull: true },
      },
    })

    if (!application) {
      throw new NotFoundException('版主申请不存在')
    }

    if (application.status !== ForumModeratorApplicationStatusEnum.PENDING) {
      throw new BadRequestException('该申请已处理，请勿重复审核')
    }

    await this.ensureSectionExists(application.sectionId)

    if (input.status === ForumModeratorApplicationStatusEnum.APPROVED) {
      await this.ensureUserNotModerator(application.applicantId)
      await this.forumModeratorService.createSectionModeratorFromApplication({
        userId: application.applicantId,
        sectionId: application.sectionId,
        permissions: this.normalizePermissions(application.permissions),
      })
    }

    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumModeratorApplication)
        .set({
          status: input.status,
          auditById: auditorId,
          auditReason: input.auditReason,
          remark: input.remark ?? application.remark,
          auditAt: new Date(),
        })
        .where(eq(this.forumModeratorApplication.id, input.id)),
    )

    return true
  }

  async deleteApplication(id: number) {
    const result = await this.drizzle.withErrorHandling(() =>
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
        )
    )
    this.drizzle.assertAffectedRows(result, '版主申请不存在')
    return true
  }

  async deleteMyApplication(userId: number, id: number) {
    const result = await this.drizzle.withErrorHandling(() =>
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
        )
    )
    this.drizzle.assertAffectedRows(result, '版主申请不存在')
    return true
  }
}
