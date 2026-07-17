import type { DbExecutor, DbTransaction, SQL } from '@db/core'
import type { ForumSectionSelect } from '@db/schema'
import type {
  ForumSectionBatchHandler,
  ForumSectionMutationSnapshot,
  ForumSectionUpdatePayload,
  ForumVisibleSectionQueryOptions,
  ForumVisibleSectionRow,
  ManagedForumSectionMutationSnapshot,
  ManagedForumSectionUpdatePayload,
} from './forum-section.type'

import {
  acquireIntegrityLocks,
  buildILikeCondition,
  DrizzleService,
  exclusiveIntegrityLock,
  sharedIntegrityLock,
  tableIntegrityLock,
  toPageResult,
} from '@db/core'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { ForumCounterService } from '../counter/forum-counter.service'
import {
  FORUM_MODERATOR_PERMISSION_LABELS,
  ForumModeratorRoleTypeEnum,
} from '../moderator/moderator.constant'
import { ForumPermissionService } from '../permission/forum-permission.service'
import { ForumSectionGroupService } from '../section-group/forum-section-group.service'
import {
  AdminForumSectionDto,
  CreateForumSectionDto,
  QueryForumSectionDto,
  QueryPublicForumSectionDto,
  SwapForumSectionSortDto,
  UpdateForumSectionDto,
  UpdateForumSectionEnabledDto,
} from './dto/forum-section.dto'

class ForumSectionSnapshotDriftError extends Error {}

const DEFAULT_REBUILD_ALL_SECTION_LIMIT = 5000

type AdminForumSectionRow = Pick<
  ForumSectionSelect,
  | 'id'
  | 'groupId'
  | 'userLevelRuleId'
  | 'lastTopicId'
  | 'name'
  | 'description'
  | 'icon'
  | 'cover'
  | 'sortOrder'
  | 'isEnabled'
  | 'topicReviewPolicy'
  | 'remark'
  | 'topicCount'
  | 'commentCount'
  | 'followersCount'
  | 'lastPostAt'
  | 'createdAt'
  | 'updatedAt'
>

/**
 * 论坛板块服务。
 * 负责板块的 CRUD、权限校验、关注状态聚合与计数重建。
 * 列表返回可见板块及访问状态，主题访问入口再执行强权限校验。
 */
@Injectable()
export class ForumSectionService {
  private readonly logger = new Logger(ForumSectionService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly followService: FollowService,
    private readonly forumCounterService: ForumCounterService,
    private readonly forumSectionGroupService: ForumSectionGroupService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  get forumSectionGroup() {
    return this.drizzle.schema.forumSectionGroup
  }

  get forumLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  get forumModerator() {
    return this.drizzle.schema.forumModerator
  }

  get forumModeratorSection() {
    return this.drizzle.schema.forumModeratorSection
  }

  get work() {
    return this.drizzle.schema.work
  }

  private getAdminForumSectionColumns() {
    return {
      id: true,
      groupId: true,
      userLevelRuleId: true,
      lastTopicId: true,
      name: true,
      description: true,
      icon: true,
      cover: true,
      sortOrder: true,
      isEnabled: true,
      topicReviewPolicy: true,
      remark: true,
      topicCount: true,
      commentCount: true,
      followersCount: true,
      lastPostAt: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  private getAdminForumSectionSelection() {
    return {
      id: this.forumSection.id,
      groupId: this.forumSection.groupId,
      userLevelRuleId: this.forumSection.userLevelRuleId,
      lastTopicId: this.forumSection.lastTopicId,
      name: this.forumSection.name,
      description: this.forumSection.description,
      icon: this.forumSection.icon,
      cover: this.forumSection.cover,
      sortOrder: this.forumSection.sortOrder,
      isEnabled: this.forumSection.isEnabled,
      topicReviewPolicy: this.forumSection.topicReviewPolicy,
      remark: this.forumSection.remark,
      topicCount: this.forumSection.topicCount,
      commentCount: this.forumSection.commentCount,
      followersCount: this.forumSection.followersCount,
      lastPostAt: this.forumSection.lastPostAt,
      createdAt: this.forumSection.createdAt,
      updatedAt: this.forumSection.updatedAt,
    }
  }

  private async assertForumLevelRuleInTx(
    tx: DbTransaction,
    userLevelRuleId: number,
  ) {
    const [levelRule] = await tx
      .select({ id: this.forumLevelRule.id })
      .from(this.forumLevelRule)
      .where(
        and(
          eq(this.forumLevelRule.id, userLevelRuleId),
          eq(this.forumLevelRule.business, 'forum'),
          eq(this.forumLevelRule.isEnabled, true),
        ),
      )
      .limit(1)

    if (!levelRule) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '论坛访问等级规则不存在或未启用',
      )
    }
  }

  private async readSectionMutationSnapshot(
    sectionId: number,
    client: DbExecutor = this.db,
  ): Promise<ForumSectionMutationSnapshot | undefined> {
    const [snapshot] = await client
      .select({
        id: this.forumSection.id,
        groupId: this.forumSection.groupId,
        userLevelRuleId: this.forumSection.userLevelRuleId,
      })
      .from(this.forumSection)
      .where(
        and(
          eq(this.forumSection.id, sectionId),
          isNull(this.forumSection.deletedAt),
        ),
      )
      .limit(1)

    return snapshot
  }

  private isSameSectionMutationSnapshot(
    left: ForumSectionMutationSnapshot | undefined,
    right: ForumSectionMutationSnapshot | undefined,
  ) {
    return (
      left?.id === right?.id &&
      left?.groupId === right?.groupId &&
      left?.userLevelRuleId === right?.userLevelRuleId
    )
  }

  private async assertSectionGroupInTx(tx: DbTransaction, groupId: number) {
    const group = await tx.query.forumSectionGroup.findFirst({
      where: { id: groupId, deletedAt: { isNull: true } },
      columns: { id: true },
    })
    if (!group) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '板块分组不存在',
      )
    }
  }

  // 串行化板块删改、发帖和移动写路径；锁注册表按规范化资源键排序避免死锁。
  private async lockSectionsForMutation(
    tx: DbTransaction,
    sectionIds: Array<number | null | undefined>,
  ) {
    const uniqueSectionIds = [
      ...new Set(sectionIds.filter(Boolean) as number[]),
    ]
    await acquireIntegrityLocks(
      tx,
      uniqueSectionIds.map((sectionId) =>
        exclusiveIntegrityLock(tableIntegrityLock('forum_section', sectionId)),
      ),
    )
  }

  private async lockSectionForMutation(tx: DbTransaction, sectionId: number) {
    await this.lockSectionsForMutation(tx, [sectionId])
  }

  /**
   * 读取作品托管板块的锁计划事实。调用方在事务外发现一次，并在取得完整锁并集后
   * 使用同一查询复核；任何字段漂移都必须回滚并以新事务重试。
   */
  async readManagedSectionMutationSnapshot(
    workId: number,
    sectionId: number,
    client: DbExecutor = this.db,
  ): Promise<ManagedForumSectionMutationSnapshot | undefined> {
    const [snapshot] = await client
      .select({
        id: this.forumSection.id,
        groupId: this.forumSection.groupId,
        userLevelRuleId: this.forumSection.userLevelRuleId,
        workId: this.drizzle.schema.work.id,
      })
      .from(this.forumSection)
      .innerJoin(
        this.drizzle.schema.work,
        and(
          eq(this.drizzle.schema.work.id, workId),
          eq(this.drizzle.schema.work.forumSectionId, this.forumSection.id),
          isNull(this.drizzle.schema.work.deletedAt),
        ),
      )
      .where(
        and(
          eq(this.forumSection.id, sectionId),
          isNull(this.forumSection.deletedAt),
        ),
      )
      .limit(1)

    return snapshot
  }

  async createManagedSectionForWork(
    tx: DbTransaction,
    input: {
      cover?: string | null
      description?: string | null
      icon?: string | null
      isEnabled?: boolean | null
      name: string
    },
  ) {
    const [createdSection] = await tx
      .insert(this.forumSection)
      .values({
        name: input.name,
        description: input.description?.slice(0, 500) ?? null,
        icon: input.icon ?? '',
        cover: input.cover ?? '',
        userLevelRuleId: null,
        isEnabled: input.isEnabled ?? true,
      })
      .returning({ id: this.forumSection.id })

    return createdSection.id
  }

  // 在 Work 根事务已完成 S-07A 全量锁获取后，同步托管板块；本 apply 阶段禁止再次取锁。
  async syncManagedSectionForWork(
    tx: DbTransaction,
    input: {
      description?: string | null
      isEnabled?: boolean | null
      name?: string | null
      sectionId: number
      workId: number
    },
  ) {
    await this.assertSectionManagedByWorkInTx(tx, input.workId, input.sectionId)

    const updatePayload: ManagedForumSectionUpdatePayload = {}
    if (input.name !== undefined && input.name !== null) {
      updatePayload.name = input.name
    }
    if (input.description !== undefined) {
      updatePayload.description = input.description?.slice(0, 500)
    }
    if (input.isEnabled !== undefined && input.isEnabled !== null) {
      updatePayload.isEnabled = input.isEnabled
    }

    if (Object.keys(updatePayload).length === 0) {
      return true
    }

    const result = await tx
      .update(this.forumSection)
      .set(updatePayload)
      .where(
        and(
          eq(this.forumSection.id, input.sectionId),
          isNull(this.forumSection.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '托管板块不存在')
    return true
  }

  // 在 Work 根事务已完成 S-07A 全量锁获取后释放托管板块，并原子清空等级规则引用。
  async releaseManagedSectionForWork(
    tx: DbTransaction,
    input: {
      deletedAt?: Date
      sectionId: number
      workId: number
    },
  ) {
    await this.assertSectionManagedByWorkInTx(tx, input.workId, input.sectionId)

    const result = await tx
      .update(this.forumSection)
      .set({
        isEnabled: false,
        userLevelRuleId: null,
        deletedAt: input.deletedAt ?? new Date(),
      })
      .where(
        and(
          eq(this.forumSection.id, input.sectionId),
          isNull(this.forumSection.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '托管板块不存在')
    return true
  }

  private async assertSectionManagedByWorkInTx(
    tx: DbTransaction,
    workId: number,
    sectionId: number,
  ) {
    const work = await tx.query.work.findFirst({
      where: {
        id: workId,
        forumSectionId: sectionId,
      },
      columns: { id: true },
    })
    if (!work) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '作品未绑定该托管板块',
      )
    }
  }

  // 分批处理 ID 列表，避免单次操作数据量过大。 用于全量重建等运维场景，按批次串行推进。
  private async processIdsInBatches(
    ids: number[],
    batchSize: number,
    handler: ForumSectionBatchHandler,
  ) {
    for (let index = 0; index < ids.length; index += batchSize) {
      const batchIds = ids.slice(index, index + batchSize)
      await handler(batchIds)
    }
  }

  // 公开板块列表的稳定原始行；过滤字段和返回字段均逐项声明，防止 schema 扩展被 RQB 默认加载。
  private getVisibleSectionColumns() {
    return {
      id: true,
      groupId: true,
      userLevelRuleId: true,
      deletedAt: true,
      name: true,
      description: true,
      icon: true,
      cover: true,
      sortOrder: true,
      isEnabled: true,
      topicReviewPolicy: true,
      topicCount: true,
      commentCount: true,
      followersCount: true,
      lastPostAt: true,
    } as const
  }

  private getVisibleSectionGroupColumns() {
    return {
      id: true,
      name: true,
      description: true,
      sortOrder: true,
      isEnabled: true,
      deletedAt: true,
    } as const
  }

  // 查询公开可见板块原始行。 支持按分组或指定 ID 集合裁剪，但始终复用同一套公开可见规则。
  private async getVisibleSectionRows(
    options?: ForumVisibleSectionQueryOptions,
  ) {
    const uniqueSectionIds = options?.sectionIds
      ? [...new Set(options.sectionIds)]
      : undefined

    if (uniqueSectionIds && uniqueSectionIds.length === 0) {
      return []
    }

    const baseWhere = {
      isEnabled: true,
      deletedAt: { isNull: true },
    } as const
    let scopeWhere = {}

    if (uniqueSectionIds !== undefined) {
      scopeWhere = { id: { in: uniqueSectionIds } }
    } else if (options?.isUngrouped) {
      scopeWhere = { groupId: { isNull: true } }
    } else if (options?.groupId !== undefined) {
      scopeWhere = { groupId: options.groupId }
    }

    const sections = await this.db.query.forumSection.findMany({
      where: {
        ...baseWhere,
        ...scopeWhere,
      },
      columns: this.getVisibleSectionColumns(),
      with: {
        group: {
          columns: this.getVisibleSectionGroupColumns(),
        },
      },
      orderBy: (section, { asc }) => [asc(section.sortOrder), asc(section.id)],
    })

    return sections
      .filter((section) =>
        this.forumPermissionService.isSectionPubliclyAvailable(section),
      )
      .sort((left, right) => {
        const leftGroupSortOrder =
          left.group?.sortOrder ?? Number.MAX_SAFE_INTEGER
        const rightGroupSortOrder =
          right.group?.sortOrder ?? Number.MAX_SAFE_INTEGER

        return (
          leftGroupSortOrder - rightGroupSortOrder ||
          left.sortOrder - right.sortOrder ||
          left.id - right.id
        )
      })
  }

  // 将公开板块原始行映射为应用侧公开 DTO 所需字段。 统一补齐访问状态与关注状态，避免多入口各自拼装。
  private async mapVisibleSectionListItems(
    sections: ForumVisibleSectionRow[],
    userId?: number,
  ) {
    if (sections.length === 0) {
      return []
    }

    const sectionIds = sections.map((section) => section.id)
    const [accessStateMap, followStatusMap] = await Promise.all([
      this.forumPermissionService.getSectionAccessStateMap(sectionIds, userId),
      userId
        ? this.followService.checkStatusBatch(
            FollowTargetTypeEnum.FORUM_SECTION,
            sectionIds,
            userId,
          )
        : Promise.resolve(new Map<number, boolean>()),
    ])

    return sections.map((section) => {
      const accessState = accessStateMap.get(section.id) ?? {
        canAccess: true,
        requiredExperience: null,
      }

      return {
        id: section.id,
        groupId: section.groupId,
        userLevelRuleId: section.userLevelRuleId,
        name: section.name,
        description: section.description,
        icon: section.icon,
        cover: section.cover,
        sortOrder: section.sortOrder,
        isEnabled: section.isEnabled,
        topicReviewPolicy: section.topicReviewPolicy,
        topicCount: section.topicCount,
        commentCount: section.commentCount,
        followersCount: section.followersCount,
        lastPostAt: section.lastPostAt,
        canAccess: accessState.canAccess,
        requiredExperience: accessState.requiredExperience,
        accessDeniedReason: accessState.canAccess
          ? null
          : (accessState.accessDeniedReason ?? null),
        isFollowed: followStatusMap.get(section.id) ?? false,
      }
    })
  }

  // 批量查询公开可见板块列表项。 供关注列表等聚合场景复用统一的公开 contract。
  async batchGetVisibleSectionListItems(sectionIds: number[], userId?: number) {
    const sections = await this.getVisibleSectionRows({ sectionIds })
    return this.mapVisibleSectionListItems(sections, userId)
  }

  // 查询板块可见列表。 - 仅返回启用且未删除的板块 - 有分组的板块要求分组也处于启用状态 - 列表侧不拦截访问权限，统一返回 canAccess 与限制提示 - 默认按分组排序、板块排序输出，便于应用侧直接渲染
  async getVisibleSectionList(query: QueryPublicForumSectionDto = {}) {
    const sections = await this.getVisibleSectionRows({
      groupId: query.groupId,
      isUngrouped: query.isUngrouped,
    })
    return this.mapVisibleSectionListItems(sections, query.userId)
  }

  // 查询板块可见详情。 详情侧返回访问状态，由主题列表接口执行强权限校验。
  async getVisibleSectionDetail(id: number, userId?: number) {
    const section = await this.db.query.forumSection.findFirst({
      where: {
        id,
        isEnabled: true,
        deletedAt: {
          isNull: true,
        },
      },
      columns: {
        id: true,
        groupId: true,
        deletedAt: true,
        userLevelRuleId: true,
        name: true,
        description: true,
        icon: true,
        cover: true,
        sortOrder: true,
        isEnabled: true,
        topicReviewPolicy: true,
        topicCount: true,
        commentCount: true,
        followersCount: true,
        lastPostAt: true,
      },
      with: {
        group: {
          columns: {
            id: true,
            name: true,
            description: true,
            sortOrder: true,
            isEnabled: true,
            deletedAt: true,
          },
        },
        work: {
          columns: {
            id: true,
          },
        },
      },
    })

    if (!section) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '板块不存在',
      )
    }

    if (!this.forumPermissionService.isSectionPubliclyAvailable(section)) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '板块不存在',
      )
    }

    const { group, work, deletedAt, ...data } = section
    void deletedAt
    const publicGroup = group
      ? {
          id: group.id,
          name: group.name,
          description: group.description,
          sortOrder: group.sortOrder,
        }
      : null

    const [followStatus, accessStateMap] = await Promise.all([
      userId
        ? this.followService.checkFollowStatus({
            targetType: FollowTargetTypeEnum.FORUM_SECTION,
            targetId: id,
            userId,
          })
        : Promise.resolve(undefined),
      this.forumPermissionService.getSectionAccessStateMap([id], userId),
    ])

    const accessState = accessStateMap.get(id) ?? {
      canAccess: true,
      requiredExperience: null,
    }

    return {
      ...data,
      workId: work?.id ?? null,
      group: publicGroup,
      canAccess: accessState.canAccess,
      requiredExperience: accessState.requiredExperience,
      accessDeniedReason: accessState.canAccess
        ? null
        : (accessState.accessDeniedReason ?? null),
      isFollowed: followStatus?.isFollowing ?? false,
    }
  }

  // 查询公开可见板块的版主摘要。 默认仅展示直接绑定该板块的板块版主，以及作用于该分组的分组版主。
  async getVisibleSectionModerators(sectionId: number) {
    const section = await this.db.query.forumSection.findFirst({
      where: {
        id: sectionId,
        isEnabled: true,
        deletedAt: {
          isNull: true,
        },
      },
      columns: {
        id: true,
        groupId: true,
        isEnabled: true,
        deletedAt: true,
      },
      with: {
        group: {
          columns: {
            id: true,
            isEnabled: true,
            deletedAt: true,
          },
        },
      },
    })

    if (
      !section ||
      !this.forumPermissionService.isSectionPubliclyAvailable(section)
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '板块不存在',
      )
    }

    const rows = await this.db
      .select({
        moderatorId: this.forumModerator.id,
        userId: this.forumModerator.userId,
        roleType: this.forumModerator.roleType,
        groupId: this.forumModerator.groupId,
        permissions: this.forumModerator.permissions,
        nickname: this.appUser.nickname,
        avatar: this.appUser.avatarUrl,
      })
      .from(this.forumModerator)
      .innerJoin(this.appUser, eq(this.appUser.id, this.forumModerator.userId))
      .leftJoin(
        this.forumModeratorSection,
        eq(this.forumModeratorSection.moderatorId, this.forumModerator.id),
      )
      .where(
        and(
          isNull(this.forumModerator.deletedAt),
          eq(this.forumModerator.isEnabled, true),
          sql`(
            (
              ${this.forumModerator.roleType} = ${ForumModeratorRoleTypeEnum.SECTION}
              and ${this.forumModeratorSection.sectionId} = ${sectionId}
            )
            or (
              ${this.forumModerator.roleType} = ${ForumModeratorRoleTypeEnum.GROUP}
              and ${this.forumModerator.groupId} = ${section.groupId}
            )
          )`,
        ),
      )

    const dedupedRows = new Map<number, (typeof rows)[number]>()
    for (const row of rows) {
      dedupedRows.set(row.moderatorId, row)
    }

    return [...dedupedRows.values()].map((row) => {
      const permissions = (row.permissions ?? []).filter(
        (
          permission,
        ): permission is keyof typeof FORUM_MODERATOR_PERMISSION_LABELS =>
          permission in FORUM_MODERATOR_PERMISSION_LABELS,
      )

      return {
        moderatorId: row.moderatorId,
        userId: row.userId,
        nickname: row.nickname,
        avatar: row.avatar ?? null,
        roleType: row.roleType,
        permissionNames: permissions.map(
          (permission) => FORUM_MODERATOR_PERMISSION_LABELS[permission],
        ),
      }
    })
  }

  // 创建论坛板块。 - 板块名称全局唯一（未删除范围内） - 关联分组与等级规则时需校验目标存在性
  async createSection(createSectionDto: CreateForumSectionDto) {
    const { groupId, userLevelRuleId, ...sectionData } = createSectionDto

    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          ...(groupId === undefined || groupId === null
            ? []
            : [
                sharedIntegrityLock(
                  tableIntegrityLock('forum_section_group', groupId),
                ),
              ]),
          ...(userLevelRuleId === undefined || userLevelRuleId === null
            ? []
            : [
                sharedIntegrityLock(
                  tableIntegrityLock('user_level_rule', userLevelRuleId),
                ),
              ]),
        ])
        if (groupId !== undefined && groupId !== null) {
          await this.assertSectionGroupInTx(tx, groupId)
        }
        if (userLevelRuleId !== undefined && userLevelRuleId !== null) {
          await this.assertForumLevelRuleInTx(tx, userLevelRuleId)
        }

        await tx.insert(this.forumSection).values({
          ...sectionData,
          userLevelRuleId,
          groupId,
        })
      },
      messages: { duplicate: '板块名称已存在' },
    })
    return true
  }

  // 获取板块分组树形结构，用于管理端板块配置页渲染。
  async getSectionTree() {
    return this.forumSectionGroupService.getAdminSectionTree()
  }

  // 管理端分页查询板块列表。 支持按名称模糊搜索、分组筛选、启用状态与审核策略筛选。 未显式传入排序时，默认遵循板块手动排序顺序。
  async getSectionPage(queryForumSectionDto: QueryForumSectionDto) {
    const { name, groupId, isUngrouped, ...otherDto } = queryForumSectionDto
    const conditions: SQL[] = [isNull(this.forumSection.deletedAt)]

    if (otherDto.isEnabled !== undefined) {
      conditions.push(eq(this.forumSection.isEnabled, otherDto.isEnabled))
    }
    if (otherDto.topicReviewPolicy !== undefined) {
      conditions.push(
        eq(this.forumSection.topicReviewPolicy, otherDto.topicReviewPolicy),
      )
    }
    if (isUngrouped) {
      conditions.push(isNull(this.forumSection.groupId))
    } else if (groupId !== undefined) {
      conditions.push(eq(this.forumSection.groupId, groupId))
    }
    if (name) {
      conditions.push(buildILikeCondition(this.forumSection.name, name)!)
    }

    const where = and(...conditions)
    const orderBy = otherDto.orderBy?.trim()
      ? otherDto.orderBy
      : { sortOrder: 'asc' as const }

    const page = this.drizzle.buildPage(otherDto)
    const orderQuery = this.drizzle.buildOrderBy(orderBy, {
      table: this.forumSection,
    })
    const [list, total] = await Promise.all([
      this.db
        .select(this.getAdminForumSectionSelection())
        .from(this.forumSection)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.forumSection, where),
    ])

    return toPageResult(
      list.map((section) => this.toAdminForumSectionDto(section)),
      total,
      page,
    )
  }

  // 管理端获取板块详情，包含关联分组信息。
  async getSectionDetail(id: number) {
    const section = await this.db.query.forumSection.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: this.getAdminForumSectionColumns(),
    })

    if (!section) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '论坛板块不存在',
      )
    }

    const group = section.groupId
      ? await this.db.query.forumSectionGroup.findFirst({
          where: { id: section.groupId, deletedAt: { isNull: true } },
          columns: {
            id: true,
            name: true,
            description: true,
            sortOrder: true,
            isEnabled: true,
          },
        })
      : null

    return {
      ...this.toAdminForumSectionDto(section),
      group: group
        ? {
            id: group.id,
            name: group.name,
            description: group.description ?? null,
            sortOrder: group.sortOrder,
            isEnabled: group.isEnabled,
          }
        : null,
    }
  }

  private toAdminForumSectionDto(
    section: AdminForumSectionRow,
  ): AdminForumSectionDto {
    return section
  }

  // 重建板块关注人数。 用于管理端修复入口与离线运维场景。
  async rebuildSectionCounts(id: number) {
    const result = await this.drizzle.withTransaction({
      execute: async (tx) => {
        const section = await tx.query.forumSection.findFirst({
          where: { id, deletedAt: { isNull: true } },
          columns: { id: true },
        })
        if (!section) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '板块不存在',
          )
        }

        const visibleState =
          await this.forumCounterService.syncSectionVisibleState(tx, id)
        const followers =
          await this.forumCounterService.rebuildSectionFollowersCount(tx, id)

        return {
          ...visibleState,
          followersCount: followers.followersCount,
        }
      },
    })

    return {
      id: result.sectionId,
      topicCount: result.topicCount,
      commentCount: result.commentCount,
      lastTopicId: result.lastTopicId,
      lastPostAt: result.lastPostAt,
      followersCount: result.followersCount,
    }
  }

  // 全量重建板块计数。 当前用于管理端运维入口，按批次串行推进以避免单次压力过大。
  async rebuildAllSectionCounts(
    batchSize = 200,
    maxSynchronousSections = DEFAULT_REBUILD_ALL_SECTION_LIMIT,
  ) {
    const sectionIds = await this.db
      .select({ id: this.forumSection.id })
      .from(this.forumSection)
      .where(isNull(this.forumSection.deletedAt))
      .orderBy(this.forumSection.id)
      .then((rows) => rows.map((row) => row.id))

    if (sectionIds.length > maxSynchronousSections) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `板块数量超过同步重建上限 ${maxSynchronousSections}，请改用后台任务执行全量重建`,
      )
    }

    let successCount = 0
    let failureCount = 0
    await this.processIdsInBatches(sectionIds, batchSize, async (ids) => {
      this.logger.log(
        `rebuild-counts-all batch start: batchSize=${batchSize}, sectionIdRange=${ids[0]}-${ids.at(-1)}, successCount=${successCount}, failureCount=${failureCount}`,
      )
      for (const sectionId of ids) {
        try {
          await this.rebuildSectionCounts(sectionId)
          successCount += 1
        } catch (error) {
          failureCount += 1
          this.logger.error(
            `rebuild-counts-all failed: sectionId=${sectionId}, successCount=${successCount}, failureCount=${failureCount}`,
            error instanceof Error ? error.stack : undefined,
          )
          throw error
        }
      }
      this.logger.log(
        `rebuild-counts-all batch complete: batchSize=${batchSize}, sectionIdRange=${ids[0]}-${ids.at(-1)}, successCount=${successCount}, failureCount=${failureCount}`,
      )
    })

    return true
  }

  // 更新论坛板块。 - 名称变更时校验全局唯一性 - 分组与等级规则变更时校验目标存在性 - 写后校验受影响行数，确保板块存在
  async updateSection(updateSectionDto: UpdateForumSectionDto) {
    const { id, name, groupId, ...updateData } = updateSectionDto
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const discoveredSection = await this.readSectionMutationSnapshot(id)
      if (!discoveredSection) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '论坛板块不存在',
        )
      }

      try {
        await this.drizzle.withTransaction({
          execute: async (tx) => {
            const requestedRuleId = updateData.userLevelRuleId
            await acquireIntegrityLocks(tx, [
              exclusiveIntegrityLock(tableIntegrityLock('forum_section', id)),
              ...[discoveredSection.groupId, groupId]
                .filter(
                  (value): value is number =>
                    value !== null && value !== undefined,
                )
                .map((value) =>
                  sharedIntegrityLock(
                    tableIntegrityLock('forum_section_group', value),
                  ),
                ),
              ...[discoveredSection.userLevelRuleId, requestedRuleId]
                .filter(
                  (value): value is number =>
                    value !== null && value !== undefined,
                )
                .map((value) =>
                  sharedIntegrityLock(
                    tableIntegrityLock('user_level_rule', value),
                  ),
                ),
            ])

            const lockedSection = await this.readSectionMutationSnapshot(id, tx)
            if (
              !this.isSameSectionMutationSnapshot(
                discoveredSection,
                lockedSection,
              )
            ) {
              throw new ForumSectionSnapshotDriftError()
            }

            const updatePayload: ForumSectionUpdatePayload = { ...updateData }
            if (name !== undefined) {
              updatePayload.name = name
            }
            if (requestedRuleId !== undefined) {
              if (requestedRuleId === null) {
                updatePayload.userLevelRuleId = null
              } else {
                await this.assertForumLevelRuleInTx(tx, requestedRuleId)
              }
            }
            if (
              groupId !== undefined &&
              groupId !== null &&
              groupId !== lockedSection?.groupId
            ) {
              await this.assertSectionGroupInTx(tx, groupId)
              updatePayload.groupId = groupId
            } else if (groupId === null && lockedSection?.groupId !== null) {
              updatePayload.groupId = null
            }

            const result = await tx
              .update(this.forumSection)
              .set(updatePayload)
              .where(
                and(
                  eq(this.forumSection.id, id),
                  isNull(this.forumSection.deletedAt),
                ),
              )
            this.drizzle.assertAffectedRows(result, '论坛板块不存在')
          },
          messages: { duplicate: '板块名称已存在' },
        })
        return true
      } catch (error) {
        if (!(error instanceof ForumSectionSnapshotDriftError)) {
          throw error
        }
        if (attempt === 1) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '论坛板块状态已变化，请重试',
          )
        }
      }
    }

    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      '论坛板块状态已变化，请重试',
    )
  }

  // 软删除论坛板块。 存在主题时禁止删除，避免孤立数据。
  async deleteSection(id: number) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const discoveredSection = await this.readSectionMutationSnapshot(id)
      if (!discoveredSection) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '论坛板块不存在',
        )
      }

      try {
        await this.drizzle.withTransaction({
          execute: async (tx) => {
            await acquireIntegrityLocks(tx, [
              exclusiveIntegrityLock(tableIntegrityLock('forum_section', id)),
              ...[discoveredSection.groupId]
                .filter((value): value is number => value !== null)
                .map((value) =>
                  sharedIntegrityLock(
                    tableIntegrityLock('forum_section_group', value),
                  ),
                ),
              ...[discoveredSection.userLevelRuleId]
                .filter((value): value is number => value !== null)
                .map((value) =>
                  sharedIntegrityLock(
                    tableIntegrityLock('user_level_rule', value),
                  ),
                ),
            ])

            const lockedSection = await this.readSectionMutationSnapshot(id, tx)
            if (
              !this.isSameSectionMutationSnapshot(
                discoveredSection,
                lockedSection,
              )
            ) {
              throw new ForumSectionSnapshotDriftError()
            }

            const liveTopic = await tx.query.forumTopic.findFirst({
              where: {
                sectionId: id,
                deletedAt: { isNull: true },
              },
              columns: { id: true },
            })

            if (liveTopic) {
              throw new BusinessException(
                BusinessErrorCode.OPERATION_NOT_ALLOWED,
                '该板块还有主题，无法删除',
              )
            }

            const activeWork = await tx.query.work.findFirst({
              where: {
                forumSectionId: id,
                deletedAt: { isNull: true },
              },
              columns: { id: true },
            })

            if (activeWork) {
              throw new BusinessException(
                BusinessErrorCode.OPERATION_NOT_ALLOWED,
                '该板块仍被作品绑定，无法删除',
              )
            }

            const moderatorSection =
              await tx.query.forumModeratorSection.findFirst({
                where: { sectionId: id },
                columns: { moderatorId: true, sectionId: true },
              })

            if (moderatorSection) {
              throw new BusinessException(
                BusinessErrorCode.OPERATION_NOT_ALLOWED,
                '该板块仍被版主作用域引用，无法删除',
              )
            }

            const result = await tx
              .update(this.forumSection)
              .set({ userLevelRuleId: null, deletedAt: new Date() })
              .where(
                and(
                  eq(this.forumSection.id, id),
                  isNull(this.forumSection.deletedAt),
                ),
              )
            this.drizzle.assertAffectedRows(result, '论坛板块不存在')
          },
        })
        return true
      } catch (error) {
        if (!(error instanceof ForumSectionSnapshotDriftError)) {
          throw error
        }
        if (attempt === 1) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '论坛板块状态已变化，请重试',
          )
        }
      }
    }

    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      '论坛板块状态已变化，请重试',
    )
  }

  // 更新板块启用状态。 写后校验受影响行数，确保板块存在。
  async updateEnabledStatus(dto: UpdateForumSectionEnabledDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.lockSectionForMutation(tx, dto.id)
        const existingSection = await tx.query.forumSection.findFirst({
          where: { id: dto.id, deletedAt: { isNull: true } },
          columns: { id: true },
        })
        if (!existingSection) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '论坛板块不存在',
          )
        }

        const result = await tx
          .update(this.forumSection)
          .set({ isEnabled: dto.isEnabled })
          .where(
            and(
              eq(this.forumSection.id, dto.id),
              isNull(this.forumSection.deletedAt),
            ),
          )
        this.drizzle.assertAffectedRows(result, '论坛板块不存在')
      },
    })
    return true
  }

  // 拖拽排序，交换两个板块的 sortOrder 字段。 仅允许同一分组内交换；未分组板块之间允许互换。
  async updateSectionSort(updateSortDto: SwapForumSectionSortDto) {
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const rows = await tx
          .select({
            id: this.forumSection.id,
            groupId: this.forumSection.groupId,
            sortOrder: this.forumSection.sortOrder,
          })
          .from(this.forumSection)
          .where(
            and(
              inArray(this.forumSection.id, [
                updateSortDto.dragId,
                updateSortDto.targetId,
              ]),
              isNull(this.forumSection.deletedAt),
            ),
          )

        const dragSection = rows.find((row) => row.id === updateSortDto.dragId)
        const targetSection = rows.find(
          (row) => row.id === updateSortDto.targetId,
        )

        if (!dragSection || !targetSection) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '论坛板块不存在',
          )
        }
        if (dragSection.groupId !== targetSection.groupId) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '板块不是同一分组',
          )
        }
        if (dragSection.sortOrder === targetSection.sortOrder) {
          return true
        }

        const groupWhere =
          dragSection.groupId === null
            ? isNull(this.forumSection.groupId)
            : eq(this.forumSection.groupId, dragSection.groupId)
        const [minimumSortOrder] = await tx
          .select({
            value: sql<number>`min(${this.forumSection.sortOrder})`.mapWith(
              Number,
            ),
          })
          .from(this.forumSection)
          .where(and(groupWhere, isNull(this.forumSection.deletedAt)))
        const temporarySortOrder = (minimumSortOrder?.value ?? 0) - 1

        await tx
          .update(this.forumSection)
          .set({ sortOrder: temporarySortOrder })
          .where(
            and(
              eq(this.forumSection.id, dragSection.id),
              isNull(this.forumSection.deletedAt),
            ),
          )
        await tx
          .update(this.forumSection)
          .set({ sortOrder: dragSection.sortOrder })
          .where(
            and(
              eq(this.forumSection.id, targetSection.id),
              isNull(this.forumSection.deletedAt),
            ),
          )
        await tx
          .update(this.forumSection)
          .set({ sortOrder: targetSection.sortOrder })
          .where(
            and(
              eq(this.forumSection.id, dragSection.id),
              isNull(this.forumSection.deletedAt),
            ),
          )

        return true
      },
    })
  }
}
