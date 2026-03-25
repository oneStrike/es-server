import type { Db } from '@db/core'
import type {
  ForumModerator,
  ForumSection,
} from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  AssignForumModeratorSectionInput,
  CreateForumModeratorInput,
  ForumModeratorSectionScope,
  ForumModeratorView,
  NormalizedModeratorScope,
  QueryForumModeratorInput,
  UpdateForumModeratorInput,
} from './moderator.type'
import { DrizzleService, escapeLikePattern } from '@db/core'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import {
  ALL_FORUM_MODERATOR_PERMISSIONS,
  FORUM_MODERATOR_PERMISSION_LABELS,
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from './moderator.constant'

/**
 * 论坛版主服务类
 * 提供论坛版主的增删改查、板块分配、权限管理等核心业务逻辑
 */
@Injectable()
export class ForumModeratorService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get forumModerator() {
    return this.drizzle.schema.forumModerator
  }

  private get forumModeratorSection() {
    return this.drizzle.schema.forumModeratorSection
  }

  private get forumSection() {
    return this.drizzle.schema.forumSection
  }

  private get forumSectionGroup() {
    return this.drizzle.schema.forumSectionGroup
  }

  private get appUser() {
    return this.drizzle.schema.appUser
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

  private async ensureUserExists(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: {
        id: userId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!user) {
      throw new BadRequestException(`ID【${userId}】数据不存在`)
    }
  }

  private async ensureGroupExists(groupId: number) {
    const group = await this.db.query.forumSectionGroup.findFirst({
      where: {
        id: groupId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!group) {
      throw new BadRequestException(`分组ID不存在: ${groupId}`)
    }
  }

  private async ensureSectionIdsExist(sectionIds: number[]) {
    const uniqueSectionIds = [...new Set(sectionIds)]

    if (uniqueSectionIds.length === 0) {
      return uniqueSectionIds
    }

    const sections = await this.db
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
      throw new BadRequestException(
        `板块ID不存在: ${missingSectionIds.join(', ')}`,
      )
    }

    return uniqueSectionIds
  }

  private async getModeratorSectionScopes(
    moderatorId: number,
  ): Promise<ForumModeratorSectionScope[]> {
    return this.db
      .select({
        sectionId: this.forumModeratorSection.sectionId,
        permissions: this.forumModeratorSection.permissions,
      })
      .from(this.forumModeratorSection)
      .where(eq(this.forumModeratorSection.moderatorId, moderatorId))
  }

  private async normalizeScope(
    input: {
      roleType?: number
      groupId?: number | null
      permissions?: Array<number | string | null | undefined>
      sectionIds?: number[]
    },
    options: {
      current?: Pick<ForumModerator, 'roleType' | 'groupId' | 'permissions'>
      currentSectionIds?: number[]
      isCreate?: boolean
    } = {},
  ): Promise<NormalizedModeratorScope> {
    const roleType = (input.roleType ??
      options.current?.roleType) as ForumModeratorRoleTypeEnum | undefined

    if (
      roleType === undefined ||
      ![
        ForumModeratorRoleTypeEnum.SUPER,
        ForumModeratorRoleTypeEnum.GROUP,
        ForumModeratorRoleTypeEnum.SECTION,
      ].includes(roleType)
    ) {
      throw new BadRequestException('版主角色类型不合法')
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

      if (!groupId) {
        throw new BadRequestException('分组版主必须指定 groupId')
      }

      await this.ensureGroupExists(groupId)

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
        : await this.ensureSectionIdsExist(input.sectionIds)

    if (options.isCreate && sectionIds.length === 0) {
      throw new BadRequestException('板块版主必须至少绑定一个板块')
    }

    if (
      !options.isCreate &&
      input.roleType === ForumModeratorRoleTypeEnum.SECTION &&
      options.current?.roleType !== ForumModeratorRoleTypeEnum.SECTION &&
      input.sectionIds === undefined
    ) {
      throw new BadRequestException('切换为板块版主时必须传 sectionIds')
    }

    return {
      roleType,
      groupId: null,
      permissions,
      sectionIds,
    }
  }

  private async clearModeratorSections(tx: Db, moderatorId: number) {
    await tx
      .delete(this.forumModeratorSection)
      .where(eq(this.forumModeratorSection.moderatorId, moderatorId))
  }

  private async syncModeratorSections(
    tx: Db,
    moderatorId: number,
    sectionIds: number[],
    customPermissions: ForumModeratorPermissionEnum[] = [],
  ) {
    const uniqueSectionIds = await this.ensureSectionIdsExist(sectionIds)
    const normalizedCustomPermissions = this.normalizePermissions(customPermissions)
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

  private mergePermissions(
    ...permissionSets: Array<Array<number | string | null | undefined> | undefined>
  ) {
    return this.normalizePermissions(permissionSets.flat())
  }

  private buildSectionView(
    section: Pick<ForumSection, 'id' | 'name'>,
    basePermissions: ForumModeratorPermissionEnum[],
    customPermissions?: Array<number | string | null | undefined> | null,
  ) {
    const normalizedCustomPermissions = this.normalizePermissions(customPermissions)

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

  private async buildModeratorViews(
    moderators: ForumModerator[],
  ): Promise<ForumModeratorView[]> {
    if (moderators.length === 0) {
      return []
    }

    const userIds = [...new Set(moderators.map((moderator) => moderator.userId))]
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

    const userMap = new Map<number, { id: number, nickname: string, avatar: string | null }>(
      users.map((user) => [user.id, user]),
    )
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
      const basePermissions = this.normalizePermissions(moderator.permissions ?? [])
      const user = userMap.get(moderator.userId)
      const group = moderator.groupId ? groupMap.get(moderator.groupId) : undefined
      const sectionScopes = scopeMap.get(moderator.id) ?? []

      let sections = sectionScopes
        .map((scope) => {
          const section = allSections.find((item) => item.id === scope.sectionId)
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

  async getModeratorDetail(id: number) {
    const moderator = await this.db.query.forumModerator.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })

    if (!moderator) {
      throw new NotFoundException('版主不存在')
    }

    const [detail] = await this.buildModeratorViews([moderator])
    return detail
  }

  /**
   * 添加版主
   * @param input 创建参数
   * @returns 创建结果
   */
  async createModerator(input: CreateForumModeratorInput) {
    await this.ensureUserExists(input.userId)

    const existing = await this.db.query.forumModerator.findFirst({
      where: {
        userId: input.userId,
      },
      columns: { id: true, deletedAt: true },
    })

    if (existing && existing.deletedAt === null) {
      throw new BadRequestException('该用户已是版主')
    }

    const scope = await this.normalizeScope(input, { isCreate: true })

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
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
      }),
    )

    return true
  }

  /**
   * 根据版主申请创建板块版主。
   * 审核通过后仅授予申请板块的 section 版主身份。
   */
  async createSectionModeratorFromApplication(input: {
    userId: number
    sectionId: number
    permissions?: ForumModeratorPermissionEnum[]
  }) {
    return this.createModerator({
      userId: input.userId,
      roleType: ForumModeratorRoleTypeEnum.SECTION,
      permissions: input.permissions,
      sectionIds: [input.sectionId],
      isEnabled: true,
    })
  }

  /**
   * 移除版主
   * @param id 版主ID
   * @returns 移除结果
   */
  async removeModerator(id: number) {
    const moderator = await this.db.query.forumModerator.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: { id: true },
    })

    if (!moderator) {
      throw new NotFoundException('版主不存在')
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
   * 分配版主管理的板块
   * @param input 分配参数
   * @returns 分配结果
   */
  async assignModeratorSection(input: AssignForumModeratorSectionInput) {
    const moderator = await this.db.query.forumModerator.findFirst({
      where: { id: input.moderatorId, deletedAt: { isNull: true } },
    })

    if (!moderator) {
      throw new NotFoundException('版主不存在')
    }

    if (moderator.roleType !== ForumModeratorRoleTypeEnum.SECTION) {
      throw new BadRequestException('仅板块版主支持分配板块')
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
   * 查看版主列表
   * @param query 查询参数
   * @returns 版主列表
   */
  async getModeratorPage(query: QueryForumModeratorInput) {
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
        .where(
          ilike(
            this.appUser.nickname,
            `%${escapeLikePattern(nickname)}%`,
          ),
        )
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
              eq(this.forumModerator.roleType, ForumModeratorRoleTypeEnum.GROUP),
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
   * 更新版主信息
   * @param input 更新参数
   * @returns 更新结果
   */
  async updateModerator(input: UpdateForumModeratorInput) {
    const moderator = await this.db.query.forumModerator.findFirst({
      where: { id: input.id, deletedAt: { isNull: true } },
    })

    if (!moderator) {
      throw new NotFoundException('版主不存在')
    }

    const currentSectionScopes = await this.getModeratorSectionScopes(input.id)
    const scope = await this.normalizeScope(input, {
      current: moderator,
      currentSectionIds: currentSectionScopes.map((item) => item.sectionId),
    })

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
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
