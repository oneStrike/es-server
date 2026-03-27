import type { SQL } from 'drizzle-orm'
import type {
  CreateForumSectionInput,
  QueryForumSectionInput,
  QueryPublicForumSectionInput,
  SwapForumSectionSortInput,
  UpdateForumSectionEnabledInput,
  UpdateForumSectionInput,
} from './section.type'
import { DrizzleService, escapeLikePattern } from '@db/core'
import {
  FollowService,
  FollowTargetTypeEnum,
} from '@libs/interaction/follow'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, ilike, isNull } from 'drizzle-orm'
import { ForumCounterService } from '../counter'
import { ForumPermissionService } from '../permission'

/**
 * 论坛板块服务。
 * 负责板块的 CRUD、权限校验、关注状态聚合与计数重建。
 * 列表返回可见板块及访问状态，主题访问入口再执行强权限校验。
 */
@Injectable()
export class ForumSectionService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly followService: FollowService,
    private readonly forumCounterService: ForumCounterService,
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

  /**
   * 分批处理 ID 列表，避免单次操作数据量过大。
   * 用于全量重建等运维场景，按批次串行推进。
   */
  private async processIdsInBatches(
    ids: number[],
    batchSize: number,
    handler: (batchIds: number[]) => Promise<void>,
  ) {
    for (let index = 0; index < ids.length; index += batchSize) {
      const batchIds = ids.slice(index, index + batchSize)
      await handler(batchIds)
    }
  }

  /**
   * 判断板块挂载的分组是否可展示。
   * 未分组板块允许直接展示；有分组时要求分组启用且未删除。
   */
  private isAvailablePublicGroup(
    group?:
      | {
          isEnabled: boolean
          deletedAt: Date | null
        }
        | null,
  ) {
    return Boolean(group && group.isEnabled && !group.deletedAt)
  }

  /**
   * 查询板块可见列表。
   * - 仅返回启用且未删除的板块
   * - 有分组的板块要求分组也处于启用状态
   * - 列表侧不拦截访问权限，统一返回 canAccess 与限制提示
   * - 默认按分组排序、板块排序输出，便于应用侧直接渲染
   */
  async getVisibleSectionList(query: QueryPublicForumSectionInput = {}) {
    const sections = await this.db.query.forumSection.findMany({
      where: {
        isEnabled: true,
        deletedAt: {
          isNull: true,
        },
        groupId: query.groupId,
      },
      columns: {
        id: true,
        groupId: true,
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
      },
      orderBy: (section, { asc }) => [asc(section.sortOrder), asc(section.id)],
    })

    const visibleSections = sections
      .filter(
        (section) =>
          !section.groupId || this.isAvailablePublicGroup(section.group),
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
      .map(({ group, ...section }) => section)

    if (visibleSections.length === 0) {
      return []
    }

    const sectionIds = visibleSections.map((section) => section.id)
    const [accessStateMap, followStatusMap] = await Promise.all([
      this.forumPermissionService.getSectionAccessStateMap(
        sectionIds,
        query.userId,
      ),
      query.userId
        ? this.followService.checkStatusBatch(
            FollowTargetTypeEnum.FORUM_SECTION,
            sectionIds,
            query.userId,
          )
        : Promise.resolve(new Map<number, boolean>()),
    ])

    return visibleSections.map((section) => {
      const accessState = accessStateMap.get(section.id) ?? {
        canAccess: true,
        requiredExperience: null,
      }

      return {
        ...section,
        canAccess: accessState.canAccess,
        requiredExperience: accessState.requiredExperience,
        accessDeniedReason: accessState.canAccess
          ? undefined
          : accessState.accessDeniedReason,
        isFollowed: followStatusMap.get(section.id) ?? false,
      }
    })
  }

  /**
   * 查询板块可见详情。
   * 详情侧返回访问状态，由主题列表接口执行强权限校验。
   */
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
      },
    })

    if (!section) {
      throw new NotFoundException('板块不存在')
    }

    if (section.groupId && !this.isAvailablePublicGroup(section.group)) {
      throw new NotFoundException('板块不存在')
    }

    const { group, ...data } = section
    let publicGroup:
      | {
          id: number
          name: string
          description: string | null
          sortOrder: number
        }
        | undefined

    if (group && this.isAvailablePublicGroup(group)) {
      publicGroup = {
        id: group.id,
        name: group.name,
        description: group.description,
        sortOrder: group.sortOrder,
      }
    }

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
      group: publicGroup,
      canAccess: accessState.canAccess,
      requiredExperience: accessState.requiredExperience,
      accessDeniedReason: accessState.canAccess
        ? undefined
        : accessState.accessDeniedReason,
      isFollowed: followStatus?.isFollowing ?? false,
    }
  }

  /**
   * 基于事实表实时计算板块的主题数与评论数。
   * 用于 repair 场景校验冗余计数字段准确性，不作为常规查询入口。
   */
  private async calculateStatistics(sectionId: number) {
    const section = await this.db.query.forumSection.findFirst({
      where: { id: sectionId, deletedAt: { isNull: true } },
      with: {
        topics: {
          where: { deletedAt: { isNull: true } },
          columns: { commentCount: true },
        },
      },
    })

    if (!section) {
      return { topicCount: 0, commentCount: 0 }
    }

    const totalCommentCount = section.topics.reduce(
      (sum, topic) => sum + topic.commentCount,
      0,
    )

    return {
      topicCount: section.topics.length,
      commentCount: totalCommentCount,
    }
  }

  /**
   * 创建论坛板块。
   * - 板块名称全局唯一（未删除范围内）
   * - 关联分组与等级规则时需校验目标存在性
   */
  async createSection(createSectionDto: CreateForumSectionInput) {
    const { name, groupId, userLevelRuleId, ...sectionData } = createSectionDto

    const existed = await this.db.query.forumSection.findFirst({
      where: { name, deletedAt: { isNull: true } },
      columns: { id: true },
    })
    if (existed) {
      throw new BadRequestException('板块名称已存在')
    }

    if (groupId) {
      const group = await this.db.query.forumSectionGroup.findFirst({
        where: { id: groupId, deletedAt: { isNull: true } },
        columns: { id: true },
      })
      if (!group) {
        throw new BadRequestException('板块分组不存在')
      }
    }
    if (userLevelRuleId) {
      const levelRule = await this.db.query.userLevelRule.findFirst({
        where: { id: userLevelRuleId },
        columns: { id: true },
      })
      if (!levelRule) {
        throw new BadRequestException('用户等级规则不存在')
      }
    }

    await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.forumSection)
        .values({
          name,
          ...sectionData,
          userLevelRuleId,
          groupId,
        }),
    )
    return true
  }

  /**
   * 获取板块分组树形结构，用于管理端板块配置页渲染。
   */
  async getSectionTree() {
    return this.db.query.forumSectionGroup.findMany({
      where: {
        deletedAt: { isNull: true },
      },
      orderBy: (group, { asc }) => [asc(group.sortOrder), asc(group.id)],
    })
  }

  /**
   * 管理端分页查询板块列表。
   * 支持按名称模糊搜索、分组筛选、启用状态与审核策略筛选。
   * 未显式传入排序时，默认遵循板块手动排序顺序。
   */
  async getSectionPage(queryForumSectionDto: QueryForumSectionInput) {
    const { name, groupId, ...otherDto } = queryForumSectionDto
    const conditions: SQL[] = [isNull(this.forumSection.deletedAt)]

    if (otherDto.isEnabled !== undefined) {
      conditions.push(eq(this.forumSection.isEnabled, otherDto.isEnabled))
    }
    if (otherDto.topicReviewPolicy !== undefined) {
      conditions.push(
        eq(this.forumSection.topicReviewPolicy, otherDto.topicReviewPolicy),
      )
    }
    if (groupId !== undefined) {
      conditions.push(eq(this.forumSection.groupId, groupId))
    }
    if (name) {
      conditions.push(
        ilike(this.forumSection.name, `%${escapeLikePattern(name)}%`),
      )
    }

    const where = and(...conditions)
    const orderBy = otherDto.orderBy?.trim()
      ? otherDto.orderBy
      : { sortOrder: 'asc' as const }

    return this.drizzle.ext.findPagination(this.forumSection, {
      where,
      ...otherDto,
      orderBy,
    })
  }

  /**
   * 管理端获取板块详情，包含关联分组信息。
   */
  async getSectionDetail(id: number) {
    const section = await this.db.query.forumSection.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    const group = section.groupId
      ? await this.db.query.forumSectionGroup.findFirst({
          where: { id: section.groupId, deletedAt: { isNull: true } },
        })
      : null

    return { ...section, group }
  }

  /**
   * 重建板块关注人数。
   * 用于管理端修复入口与离线运维场景。
   */
  async rebuildSectionFollowersCount(id: number) {
    const result = await this.forumCounterService.rebuildSectionFollowersCount(
      undefined,
      id,
    )
    return {
      id: result.sectionId,
      followersCount: result.followersCount,
    }
  }

  /**
   * 全量重建板块关注人数。
   * 当前用于管理端运维入口，按批次串行推进以避免单次压力过大。
   */
  async rebuildAllSectionFollowersCount(batchSize = 200) {
    const sectionIds = await this.db
      .select({ id: this.forumSection.id })
      .from(this.forumSection)
      .where(isNull(this.forumSection.deletedAt))
      .orderBy(this.forumSection.id)
      .then((rows) => rows.map((row) => row.id))

    await this.processIdsInBatches(sectionIds, batchSize, async (ids) => {
      await Promise.all(
        ids.map(async (sectionId) =>
          this.forumCounterService.rebuildSectionFollowersCount(
            undefined,
            sectionId,
          ),
        ),
      )
    })

    return true
  }

  /**
   * 更新论坛板块。
   * - 名称变更时校验全局唯一性
   * - 分组与等级规则变更时校验目标存在性
   * - 写后校验受影响行数，确保板块存在
   */
  async updateSection(updateSectionDto: UpdateForumSectionInput) {
    const { id, name, groupId, ...updateData } = updateSectionDto

    const existingSection = await this.db.query.forumSection.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })

    if (!existingSection) {
      throw new BadRequestException('论坛板块不存在')
    }

    if (name && name !== existingSection.name) {
      const duplicateSection = await this.db.query.forumSection.findFirst({
        where: {
          name,
          deletedAt: { isNull: true },
        },
      })
      if (duplicateSection && duplicateSection.id !== id) {
        throw new BadRequestException('板块名称已存在')
      }
    }

    const updatePayload: Record<string, unknown> = {
      name,
      ...updateData,
    }

    if (
      updateData.userLevelRuleId !== undefined &&
      updateData.userLevelRuleId !== existingSection.userLevelRuleId
    ) {
      if (updateData.userLevelRuleId === null) {
        updatePayload.userLevelRuleId = null
      } else {
      const levelRule = await this.db.query.userLevelRule.findFirst({
        where: { id: updateData.userLevelRuleId },
        columns: { id: true },
      })

      if (!levelRule) {
        throw new BadRequestException('用户等级规则不存在')
      }
      }
    }

    if (groupId && groupId !== existingSection.groupId) {
      const group = await this.db.query.forumSectionGroup.findFirst({
        where: { id: groupId, deletedAt: { isNull: true } },
        columns: { id: true },
      })
      if (!group) {
        throw new BadRequestException('板块分组不存在')
      }
      updatePayload.groupId = groupId
    } else if (groupId === null && existingSection.groupId !== null) {
      updatePayload.groupId = null
    }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumSection)
        .set(updatePayload)
        .where(
          and(eq(this.forumSection.id, id), isNull(this.forumSection.deletedAt)),
        )
    )
    this.drizzle.assertAffectedRows(result, '论坛板块不存在')
    return true
  }

  /**
   * 软删除论坛板块。
   * 存在主题时禁止删除，避免孤立数据。
   */
  async deleteSection(id: number) {
    const section = await this.db.query.forumSection.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    if (section.topicCount > 0) {
      throw new BadRequestException(
        `该板块还有 ${section.topicCount} 个主题，无法删除`,
      )
    }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumSection)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(this.forumSection.id, id), isNull(this.forumSection.deletedAt)),
        )
    )
    this.drizzle.assertAffectedRows(result, '论坛板块不存在')
    return true
  }

  /**
   * 更新板块启用状态。
   * 写后校验受影响行数，确保板块存在。
   */
  async updateEnabledStatus(dto: UpdateForumSectionEnabledInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumSection)
        .set({ isEnabled: dto.isEnabled })
        .where(
          and(
            eq(this.forumSection.id, dto.id),
            isNull(this.forumSection.deletedAt),
          ),
        )
    )
    this.drizzle.assertAffectedRows(result, '论坛板块不存在')
    return true
  }

  /**
   * 拖拽排序，交换两个板块的 sortOrder 字段。
   * 仅允许同一分组内交换；未分组板块之间允许互换。
   */
  async updateSectionSort(updateSortDto: SwapForumSectionSortInput) {
    return this.drizzle.ext.swapField(this.forumSection, {
      where: [{ id: updateSortDto.dragId }, { id: updateSortDto.targetId }],
      sourceField: 'groupId',
    })
  }
}
