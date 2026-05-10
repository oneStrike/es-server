import type { Db } from '@db/core'
import type { ForumModeratorSelect, ForumSectionSelect } from '@db/schema'

import type { SQL } from 'drizzle-orm'
import type {
  ForumModeratorGroupLimitOptions,
  ForumModeratorPermissionGrant,
  NormalizedModeratorScope,
  NormalizeModeratorScopeOptions,
} from './moderator.type'
import { buildILikeCondition, DrizzleService } from '@db/core'

import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { FORUM_SECTION_GROUP_MUTATION_LOCK_NAMESPACE } from '../section-group/forum-section-group.constant'
import {
  AssignForumModeratorSectionDto,
  CreateForumModeratorDto,
  QueryForumModeratorDto,
  UpdateForumModeratorDto,
} from './dto/moderator.dto'
import {
  ALL_FORUM_MODERATOR_PERMISSIONS,
  FORUM_MODERATOR_PERMISSION_LABELS,
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from './moderator.constant'

/**
 * 论坛版主服务。
 * 负责版主角色归一化、板块作用域同步，以及后台管理所需的详情与分页视图装配。
 */
@Injectable()
export class ForumModeratorService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 统一复用当前模块的 Drizzle 数据库实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** forum_moderator 表访问入口。 */
  private get forumModerator() {
    return this.drizzle.schema.forumModerator
  }

  /** forum_moderator_section 表访问入口。 */
  private get forumModeratorSection() {
    return this.drizzle.schema.forumModeratorSection
  }

  /** forum_section 表访问入口。 */
  private get forumSection() {
    return this.drizzle.schema.forumSection
  }

  /** forum_section_group 表访问入口。 */
  private get forumSectionGroup() {
    return this.drizzle.schema.forumSectionGroup
  }

  /** app_user 表访问入口。 */
  private get appUser() {
    return this.drizzle.schema.appUser
  }

  // 对同一分组的治理写路径加事务级 advisory lock，避免并发删除和配额校验互相穿透。
  private async lockSectionGroupsForMutation(
    client: Db,
    groupIds: Array<number | null | undefined>,
  ) {
    const uniqueGroupIds = [
      ...new Set(groupIds.filter(Boolean) as number[]),
    ].sort((left, right) => left - right)

    for (const groupId of uniqueGroupIds) {
      await client.execute(
        sql`SELECT pg_advisory_xact_lock(${FORUM_SECTION_GROUP_MUTATION_LOCK_NAMESPACE}, ${groupId})`,
      )
    }
  }

  /**
   * 归一化权限数组。
   * 仅保留仓库定义的合法权限值，并按系统标准顺序返回，避免写库时出现脏枚举或乱序数组。
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
   * 将权限值映射为后台展示文案。
   * 该映射仅用于返回管理端视图，不参与任何鉴权判断。
   */
  private getPermissionNames(permissions: ForumModeratorPermissionEnum[]) {
    return permissions.map(
      (permission) => FORUM_MODERATOR_PERMISSION_LABELS[permission],
    )
  }

  /**
   * 返回当前有效版主记录。
   * moderator governance 会复用这条查询来绑定 moderatorId 与 actor userId。
   */
  private async getActiveModeratorByUserId(userId: number) {
    return this.db.query.forumModerator.findFirst({
      where: {
        userId,
        isEnabled: true,
        deletedAt: { isNull: true },
      },
    })
  }

  /**
   * 校验目标用户存在且未软删除。
   * 创建版主前提前失败，避免事务内才发现脏 userId。
   */
  private async ensureUserExists(userId: number, client: Db = this.db) {
    const user = await client.query.appUser.findFirst({
      where: {
        id: userId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        `ID【${userId}】数据不存在`,
      )
    }
  }

  /**
   * 校验版主分组存在。
   * 仅分组版主路径允许写入 groupId，因此在角色归一化阶段完成该约束。
   */
  private async ensureGroupExists(groupId: number, client: Db = this.db) {
    const group = await client.query.forumSectionGroup.findFirst({
      where: {
        id: groupId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        maxModerators: true,
      },
    })

    if (!group) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        `分组ID不存在: ${groupId}`,
      )
    }

    return group
  }

  // 校验分组版主数量上限，避免分组配置只停留在展示层。
  private async ensureGroupModeratorCapacity(
    groupId: number,
    options: ForumModeratorGroupLimitOptions,
  ) {
    const client = options.client ?? this.db
    await this.lockSectionGroupsForMutation(client, [groupId])
    const group = await this.ensureGroupExists(groupId, client)

    if (!options.nextIsEnabled || group.maxModerators === 0) {
      return
    }

    const moderators = await client.query.forumModerator.findMany({
      where: {
        groupId,
        roleType: ForumModeratorRoleTypeEnum.GROUP,
        isEnabled: true,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
      },
    })
    const effectiveCount = moderators.filter(
      (moderator) => moderator.id !== options.excludeModeratorId,
    ).length

    if (effectiveCount >= group.maxModerators) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '该分组版主数量已达上限',
      )
    }
  }

  /**
   * 校验并去重板块 ID 列表。
   * 返回值会保留调用方传入顺序，缺失板块会一次性汇总为业务异常。
   */
  private async ensureSectionIdsExist(
    sectionIds: number[],
    client: Db = this.db,
  ) {
    const uniqueSectionIds = [...new Set(sectionIds)]

    if (uniqueSectionIds.length === 0) {
      return uniqueSectionIds
    }

    const sections = await client
      .select({ id: this.forumSection.id })
      .from(this.forumSection)
      .where(
        and(
          inArray(this.forumSection.id, uniqueSectionIds),
          isNull(this.forumSection.deletedAt),
        ),
      )

    const existingSectionIds = sections.map((section) => section.id)
    const missingSectionIds = uniqueSectionIds.filter(
      (sectionId) => !existingSectionIds.includes(sectionId),
    )

    if (missingSectionIds.length > 0) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        `板块ID不存在: ${missingSectionIds.join(', ')}`,
      )
    }

    return uniqueSectionIds
  }

  /**
   * 查询版主当前绑定的板块作用域。
   * update/assign 路径都依赖该快照来决定增量清理与补写策略。
   */
  private async getModeratorSectionScopes(
    moderatorId: number,
    client: Db = this.db,
  ) {
    return client
      .select({
        sectionId: this.forumModeratorSection.sectionId,
        permissions: this.forumModeratorSection.permissions,
      })
      .from(this.forumModeratorSection)
      .where(eq(this.forumModeratorSection.moderatorId, moderatorId))
  }

  /**
   * 将不同入口传入的角色、分组、权限和板块范围归一化为统一落库结构。
   * 这里集中处理角色切换约束，避免 create/update/审核通过等写路径出现分叉规则。
   */
  private async normalizeScope(
    input: {
      roleType?: number
      groupId?: number | null
      isEnabled?: boolean
      permissions?: Array<number | null | undefined> | null
      sectionIds?: number[]
    },
    options: NormalizeModeratorScopeOptions = {},
  ): Promise<NormalizedModeratorScope> {
    const client = options.client ?? this.db
    const roleType = (input.roleType ?? options.current?.roleType) as
      | ForumModeratorRoleTypeEnum
      | undefined

    if (
      roleType === undefined ||
      ![
        ForumModeratorRoleTypeEnum.SUPER,
        ForumModeratorRoleTypeEnum.GROUP,
        ForumModeratorRoleTypeEnum.SECTION,
      ].includes(roleType)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '版主角色类型不合法',
      )
    }

    if (roleType === ForumModeratorRoleTypeEnum.SUPER) {
      return {
        roleType,
        groupId: null,
        permissions: [...ALL_FORUM_MODERATOR_PERMISSIONS],
        sectionIds: [],
      }
    }

    const permissions = this.normalizePermissions(
      input.permissions ?? options.current?.permissions ?? [],
    )

    if (roleType === ForumModeratorRoleTypeEnum.GROUP) {
      const groupId =
        input.groupId === undefined
          ? (options.current?.groupId ?? null)
          : input.groupId
      const nextIsEnabled =
        input.isEnabled ?? options.current?.isEnabled ?? true

      if (!groupId) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '分组版主必须指定 groupId',
        )
      }

      await this.ensureGroupModeratorCapacity(groupId, {
        client,
        excludeModeratorId: options.current?.id,
        nextIsEnabled,
      })

      return {
        roleType,
        groupId,
        permissions,
        sectionIds: [],
      }
    }

    const sectionIds =
      input.sectionIds === undefined
        ? [...(options.currentSectionIds ?? [])]
        : await this.ensureSectionIdsExist(input.sectionIds, client)

    if (options.isCreate && sectionIds.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '板块版主必须至少绑定一个板块',
      )
    }

    if (
      !options.isCreate &&
      input.roleType === ForumModeratorRoleTypeEnum.SECTION &&
      options.current?.roleType !== ForumModeratorRoleTypeEnum.SECTION &&
      input.sectionIds === undefined
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '切换为板块版主时必须传 sectionIds',
      )
    }

    return {
      roleType,
      groupId: null,
      permissions,
      sectionIds,
    }
  }

  /**
   * 清空版主的板块绑定范围。
   * 当角色切换为超级版主或分组版主时，必须同步移除遗留 section 作用域。
   */
  private async clearModeratorSections(tx: Db, moderatorId: number) {
    await tx
      .delete(this.forumModeratorSection)
      .where(eq(this.forumModeratorSection.moderatorId, moderatorId))
  }

  /**
   * 同步板块版主的板块绑定与自定义权限。
   * 该方法会在事务内执行增删改，保证 forum_moderator 与 forum_moderator_section 不出现半成功状态。
   */
  private async syncModeratorSections(
    tx: Db,
    moderatorId: number,
    sectionIds: number[],
    customPermissions?: ForumModeratorPermissionEnum[] | null,
  ) {
    const uniqueSectionIds = await this.ensureSectionIdsExist(sectionIds, tx)
    const normalizedCustomPermissions =
      this.normalizePermissions(customPermissions)
    const existingScopes = await tx
      .select({ sectionId: this.forumModeratorSection.sectionId })
      .from(this.forumModeratorSection)
      .where(eq(this.forumModeratorSection.moderatorId, moderatorId))

    const existingSectionIds = existingScopes.map((item) => item.sectionId)
    const removedSectionIds = existingSectionIds.filter(
      (sectionId) => !uniqueSectionIds.includes(sectionId),
    )

    if (removedSectionIds.length > 0) {
      await tx
        .delete(this.forumModeratorSection)
        .where(
          and(
            eq(this.forumModeratorSection.moderatorId, moderatorId),
            inArray(this.forumModeratorSection.sectionId, removedSectionIds),
          ),
        )
    }

    if (uniqueSectionIds.length === 0) {
      await this.clearModeratorSections(tx, moderatorId)
      return
    }

    await Promise.all(
      uniqueSectionIds.map((sectionId) =>
        tx
          .insert(this.forumModeratorSection)
          .values({
            moderatorId,
            sectionId,
            permissions: normalizedCustomPermissions,
          })
          .onConflictDoUpdate({
            target: [
              this.forumModeratorSection.moderatorId,
              this.forumModeratorSection.sectionId,
            ],
            set: {
              permissions: normalizedCustomPermissions,
            },
          }),
      ),
    )
  }

  /**
   * 合并多份权限集合并重新按标准顺序归一化。
   * 用于构造板块最终生效权限，避免重复值影响前端展示。
   */
  private mergePermissions(
    ...permissionSets: Array<Array<number | null | undefined> | undefined>
  ) {
    return this.normalizePermissions(permissionSets.flat())
  }

  /**
   * 将板块与版主权限拼装为后台可读视图。
   * 自定义权限为空时显式标记 inheritFromParent，便于前端区分继承和覆写状态。
   */
  private buildSectionView(
    section: Pick<ForumSectionSelect, 'id' | 'name'>,
    basePermissions: ForumModeratorPermissionEnum[],
    customPermissions?: Array<number | null | undefined> | null,
  ) {
    const normalizedCustomPermissions =
      this.normalizePermissions(customPermissions)

    return {
      id: section.id,
      name: section.name,
      inheritFromParent: normalizedCustomPermissions.length === 0,
      customPermissions: normalizedCustomPermissions,
      finalPermissions: this.mergePermissions(
        basePermissions,
        normalizedCustomPermissions,
      ),
    }
  }

  /**
   * 批量装配版主管理端视图。
   * 查询用户、分组与板块作用域后一次性拼装，避免 controller 层再做二次聚合。
   */
  private async buildModeratorViews(moderators: ForumModeratorSelect[]) {
    if (moderators.length === 0) {
      return []
    }

    const userIds = [
      ...new Set(moderators.map((moderator) => moderator.userId)),
    ]
    const groupIds = [
      ...new Set(
        moderators
          .map((moderator) => moderator.groupId)
          .filter((groupId): groupId is number => groupId !== null),
      ),
    ]
    const moderatorIds = moderators.map((moderator) => moderator.id)

    const [users, groups, allSections, scopes] = await Promise.all([
      this.db
        .select({
          id: this.appUser.id,
          nickname: this.appUser.nickname,
          avatar: this.appUser.avatarUrl,
        })
        .from(this.appUser)
        .where(inArray(this.appUser.id, userIds)),
      groupIds.length > 0
        ? this.db
            .select({
              id: this.forumSectionGroup.id,
              name: this.forumSectionGroup.name,
            })
            .from(this.forumSectionGroup)
            .where(
              and(
                inArray(this.forumSectionGroup.id, groupIds),
                isNull(this.forumSectionGroup.deletedAt),
              ),
            )
        : Promise.resolve([] as Array<{ id: number, name: string }>),
      this.db
        .select({
          id: this.forumSection.id,
          name: this.forumSection.name,
          groupId: this.forumSection.groupId,
        })
        .from(this.forumSection)
        .where(isNull(this.forumSection.deletedAt)),
      this.db
        .select({
          moderatorId: this.forumModeratorSection.moderatorId,
          sectionId: this.forumModeratorSection.sectionId,
          permissions: this.forumModeratorSection.permissions,
        })
        .from(this.forumModeratorSection)
        .where(inArray(this.forumModeratorSection.moderatorId, moderatorIds)),
    ])

    const userMap = new Map<
      number,
      { id: number, nickname: string, avatar: string | null }
    >(users.map((user) => [user.id, user]))
    const groupMap = new Map<number, { id: number, name: string }>(
      groups.map((group) => [group.id, group]),
    )
    const scopeMap = new Map<number, Array<(typeof scopes)[number]>>()

    for (const scope of scopes) {
      const list = scopeMap.get(scope.moderatorId) ?? []
      list.push(scope)
      scopeMap.set(scope.moderatorId, list)
    }

    return moderators.map((moderator) => {
      const basePermissions = this.normalizePermissions(
        moderator.permissions ?? [],
      )
      const user = userMap.get(moderator.userId)
      const group = moderator.groupId
        ? groupMap.get(moderator.groupId)
        : undefined
      const sectionScopes = scopeMap.get(moderator.id) ?? []

      let sections = sectionScopes
        .map((scope) => {
          const section = allSections.find(
            (item) => item.id === scope.sectionId,
          )
          return section
            ? this.buildSectionView(section, basePermissions, scope.permissions)
            : null
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)

      if (moderator.roleType === ForumModeratorRoleTypeEnum.SUPER) {
        sections = allSections.map((section) =>
          this.buildSectionView(section, basePermissions),
        )
      } else if (moderator.roleType === ForumModeratorRoleTypeEnum.GROUP) {
        sections = allSections
          .filter((section) => section.groupId === moderator.groupId)
          .map((section) => this.buildSectionView(section, basePermissions))
      }

      return {
        id: moderator.id,
        createdAt: moderator.createdAt,
        updatedAt: moderator.updatedAt,
        userId: moderator.userId,
        groupId: moderator.groupId ?? undefined,
        roleType: moderator.roleType,
        permissions: basePermissions,
        isEnabled: moderator.isEnabled,
        remark: moderator.remark ?? undefined,
        nickname: user?.nickname ?? '',
        avatar: user?.avatar ?? undefined,
        group: group
          ? {
              id: group.id,
              name: group.name,
            }
          : undefined,
        permissionNames: this.getPermissionNames(basePermissions),
        sections,
      }
    })
  }

  /**
   * 查询单个版主详情。
   * 缺失记录直接抛出 not-found，避免前端误把空详情当成可编辑对象。
   */
  async getModeratorDetail(id: number) {
    const moderator = await this.db.query.forumModerator.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })

    if (!moderator) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '版主不存在',
      )
    }

    const [detail] = await this.buildModeratorViews([moderator])
    return detail
  }

  /**
   * 创建版主。
   * 同一用户只允许存在一条有效版主记录；若命中已软删除旧记录，则在事务内复活并重建作用域。
   */
  private async createModeratorInTx(tx: Db, input: CreateForumModeratorDto) {
    await this.ensureUserExists(input.userId, tx)

    const existing = await tx.query.forumModerator.findFirst({
      where: {
        userId: input.userId,
      },
      columns: { id: true, deletedAt: true },
    })

    if (existing && existing.deletedAt === null) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
        '该用户已是版主',
      )
    }

    const scope = await this.normalizeScope(input, {
      client: tx,
      isCreate: true,
    })

    const moderatorData = {
      groupId: scope.groupId,
      roleType: scope.roleType,
      permissions: scope.permissions,
      isEnabled: input.isEnabled ?? true,
      remark: input.remark ?? null,
    }

    const moderatorId = existing?.id
      ? existing.id
      : (
          await tx
            .insert(this.forumModerator)
            .values({
              userId: input.userId,
              ...moderatorData,
            })
            .returning({ id: this.forumModerator.id })
        )[0].id

    if (existing?.id) {
      const result = await tx
        .update(this.forumModerator)
        .set({
          ...moderatorData,
          deletedAt: null,
        })
        .where(eq(this.forumModerator.id, existing.id))
      this.drizzle.assertAffectedRows(result, '版主不存在')
    }

    if (scope.roleType === ForumModeratorRoleTypeEnum.SECTION) {
      await this.syncModeratorSections(tx, moderatorId, scope.sectionIds)
    } else {
      await this.clearModeratorSections(tx, moderatorId)
    }
  }

  /**
   * 创建版主。
   * 同一用户只允许存在一条有效版主记录；若命中已软删除旧记录，则在事务内复活并重建作用域。
   */
  async createModerator(input: CreateForumModeratorDto, tx?: Db) {
    if (tx) {
      await this.createModeratorInTx(tx, input)
      return true
    }

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (innerTx) => {
        await this.createModeratorInTx(innerTx, input)
      }),
    )

    return true
  }

  /**
   * 根据版主申请创建板块版主。
   * 审核通过后仅授予申请板块的 section 版主身份。
   */
  async createSectionModeratorFromApplication(
    input: {
      userId: number
      sectionId: number
      permissions?: ForumModeratorPermissionEnum[]
    },
    tx?: Db,
  ) {
    return this.createModerator(
      {
        userId: input.userId,
        roleType: ForumModeratorRoleTypeEnum.SECTION,
        permissions: input.permissions,
        sectionIds: [input.sectionId],
        isEnabled: true,
      },
      tx,
    )
  }

  /**
   * 软删除版主。
   * 删除时会同步清空板块作用域，避免残留 forum_moderator_section 记录继续生效。
   */
  async removeModerator(id: number) {
    const moderator = await this.db.query.forumModerator.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: { id: true },
    })

    if (!moderator) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '版主不存在',
      )
    }

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        await this.clearModeratorSections(tx, id)
        const rows = await tx
          .update(this.forumModerator)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(this.forumModerator.id, id),
              isNull(this.forumModerator.deletedAt),
            ),
          )

        this.drizzle.assertAffectedRows(rows, '版主不存在')
      }),
    )

    return true
  }

  /**
   * 调整板块版主管理的板块范围。
   * 仅 section 版主允许调用该路径，分组/超级版主的范围由角色本身隐式决定。
   */
  async assignModeratorSection(input: AssignForumModeratorSectionDto) {
    const moderator = await this.db.query.forumModerator.findFirst({
      where: { id: input.moderatorId, deletedAt: { isNull: true } },
    })

    if (!moderator) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '版主不存在',
      )
    }

    if (moderator.roleType !== ForumModeratorRoleTypeEnum.SECTION) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '仅板块版主支持分配板块',
      )
    }

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        await this.syncModeratorSections(
          tx,
          input.moderatorId,
          input.sectionIds,
          input.permissions,
        )
      }),
    )

    return true
  }

  /**
   * 分页查询版主列表。
   * sectionId 过滤会同时匹配超级版主、分组版主和显式绑定该板块的板块版主。
   */
  async getModeratorPage(query: QueryForumModeratorDto) {
    const { nickname, sectionId, ...otherDto } = query
    const conditions: SQL[] = []

    conditions.push(isNull(this.forumModerator.deletedAt))
    if (query.isEnabled !== undefined) {
      conditions.push(eq(this.forumModerator.isEnabled, query.isEnabled))
    }
    if (query.userId !== undefined) {
      conditions.push(eq(this.forumModerator.userId, query.userId))
    }

    if (nickname) {
      const users = await this.db
        .select({ id: this.appUser.id })
        .from(this.appUser)
        .where(buildILikeCondition(this.appUser.nickname, nickname))
      const userIds = users.map((user) => user.id)

      conditions.push(
        userIds.length > 0
          ? inArray(this.forumModerator.userId, userIds)
          : eq(this.forumModerator.id, -1),
      )
    }

    if (sectionId !== undefined) {
      const section = await this.db.query.forumSection.findFirst({
        where: {
          id: sectionId,
          deletedAt: { isNull: true },
        },
        columns: {
          id: true,
          groupId: true,
        },
      })

      if (!section) {
        conditions.push(eq(this.forumModerator.id, -1))
      } else {
        const sectionModeratorIds = await this.db
          .select({ moderatorId: this.forumModeratorSection.moderatorId })
          .from(this.forumModeratorSection)
          .where(eq(this.forumModeratorSection.sectionId, sectionId))
        const scopedConditions: SQL[] = [
          eq(this.forumModerator.roleType, ForumModeratorRoleTypeEnum.SUPER),
        ]

        if (section.groupId) {
          scopedConditions.push(
            and(
              eq(
                this.forumModerator.roleType,
                ForumModeratorRoleTypeEnum.GROUP,
              ),
              eq(this.forumModerator.groupId, section.groupId),
            )!,
          )
        }

        if (sectionModeratorIds.length > 0) {
          scopedConditions.push(
            inArray(
              this.forumModerator.id,
              sectionModeratorIds.map((item) => item.moderatorId),
            ),
          )
        }

        conditions.push(or(...scopedConditions)!)
      }
    }

    const page = await this.drizzle.ext.findPagination(this.forumModerator, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      ...otherDto,
    })

    return {
      ...page,
      list: await this.buildModeratorViews(page.list),
    }
  }

  /**
   * 校验版主是否对指定板块具备某项治理权限。
   * admin 与 moderator 的分流在 governance service 中处理；本方法只负责 moderator 视角的强校验。
   */
  async ensureModeratorPermissionForSection(
    userId: number,
    sectionId: number,
    permission: ForumModeratorPermissionEnum,
  ): Promise<ForumModeratorPermissionGrant> {
    const moderator = await this.getActiveModeratorByUserId(userId)

    if (!moderator) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前用户不是可用版主',
      )
    }

    const section = await this.db.query.forumSection.findFirst({
      where: {
        id: sectionId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        groupId: true,
      },
    })

    if (!section) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '板块不存在',
      )
    }

    const basePermissions = this.normalizePermissions(
      moderator.permissions ?? [],
    )
    let grantedPermissions = basePermissions

    if (moderator.roleType === ForumModeratorRoleTypeEnum.GROUP) {
      if (!section.groupId || section.groupId !== moderator.groupId) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '当前版主无权治理该板块',
        )
      }
    } else if (moderator.roleType === ForumModeratorRoleTypeEnum.SECTION) {
      const scope = await this.db.query.forumModeratorSection.findFirst({
        where: {
          moderatorId: moderator.id,
          sectionId,
        },
        columns: {
          permissions: true,
        },
      })

      if (!scope) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '当前版主无权治理该板块',
        )
      }

      grantedPermissions = this.mergePermissions(
        basePermissions,
        scope.permissions ?? [],
      )
    }

    if (!grantedPermissions.includes(permission)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `当前版主缺少【${FORUM_MODERATOR_PERMISSION_LABELS[permission]}】权限`,
      )
    }

    return {
      moderatorId: moderator.id,
      moderatorUserId: moderator.userId,
      roleType: moderator.roleType,
      sectionId: section.id,
      grantedPermissions,
    }
  }

  /**
   * 更新版主信息。
   * 角色切换会触发作用域重算，并在同一事务内同步清理或重建板块绑定。
   */
  async updateModerator(input: UpdateForumModeratorDto) {
    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const moderator = await tx.query.forumModerator.findFirst({
          where: { id: input.id, deletedAt: { isNull: true } },
        })

        if (!moderator) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '版主不存在',
          )
        }

        const targetRoleType = (input.roleType ?? moderator.roleType) as
          | ForumModeratorRoleTypeEnum
          | undefined
        const targetGroupId =
          targetRoleType === ForumModeratorRoleTypeEnum.GROUP
            ? input.groupId === undefined
              ? moderator.groupId
              : input.groupId
            : null

        await this.lockSectionGroupsForMutation(tx, [
          moderator.roleType === ForumModeratorRoleTypeEnum.GROUP
            ? moderator.groupId
            : null,
          targetGroupId,
        ])

        const currentSectionScopes = await this.getModeratorSectionScopes(
          input.id,
          tx,
        )
        const scope = await this.normalizeScope(input, {
          client: tx,
          current: moderator,
          currentSectionIds: currentSectionScopes.map((item) => item.sectionId),
        })

        const result = await tx
          .update(this.forumModerator)
          .set({
            groupId: scope.groupId,
            roleType: scope.roleType,
            permissions: scope.permissions,
            isEnabled: input.isEnabled ?? moderator.isEnabled,
            remark: input.remark ?? moderator.remark,
          })
          .where(
            and(
              eq(this.forumModerator.id, input.id),
              isNull(this.forumModerator.deletedAt),
            ),
          )
        this.drizzle.assertAffectedRows(result, '版主不存在')

        if (scope.roleType === ForumModeratorRoleTypeEnum.SECTION) {
          await this.syncModeratorSections(tx, input.id, scope.sectionIds)
        } else {
          await this.clearModeratorSections(tx, input.id)
        }
      }),
    )

    return true
  }
}
