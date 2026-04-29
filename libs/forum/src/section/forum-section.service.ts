import type { Db, SQL } from '@db/core'
import { buildILikeCondition, DrizzleService } from '@db/core'

import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumPermissionService } from '../permission/forum-permission.service'
import { FORUM_SECTION_GROUP_MUTATION_LOCK_NAMESPACE } from '../section-group/forum-section-group.constant'
import { ForumSectionGroupService } from '../section-group/forum-section-group.service'
import {
  CreateForumSectionDto,
  QueryForumSectionDto,
  QueryPublicForumSectionDto,
  SwapForumSectionSortDto,
  UpdateForumSectionDto,
  UpdateForumSectionEnabledDto,
} from './dto/forum-section.dto'
import { FORUM_SECTION_MUTATION_LOCK_NAMESPACE } from './forum-section.constant'
import type {
  ForumSectionBatchHandler,
  ForumVisibleSectionQueryOptions,
  ForumVisibleSectionRow,
} from './forum-section.type'

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

  // 对会写 forum_section.group_id 的路径加事务级 advisory lock，和删分组共用同一命名空间。
  private async lockSectionGroupsForMutation(
    client: Db,
    groupIds: Array<number | null | undefined>,
  ) {
    const uniqueGroupIds = [...new Set(groupIds.filter(Boolean) as number[])].sort(
      (left, right) => left - right,
    )

    for (const groupId of uniqueGroupIds) {
      await client.execute(
        sql`SELECT pg_advisory_xact_lock(${FORUM_SECTION_GROUP_MUTATION_LOCK_NAMESPACE}, ${groupId})`,
      )
    }
  }

  // 串行化单个板块的删改与发帖写操作，避免删除与新主题写入交错。
  private async lockSectionForMutation(client: Db, sectionId: number) {
    await client.execute(
      sql`SELECT pg_advisory_xact_lock(${FORUM_SECTION_MUTATION_LOCK_NAMESPACE}, ${sectionId})`,
    )
  }

  /**
   * 分批处理 ID 列表，避免单次操作数据量过大。
   * 用于全量重建等运维场景，按批次串行推进。
   */
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

  /**
   * 查询公开可见板块原始行。
   * 支持按分组或指定 ID 集合裁剪，但始终复用同一套公开可见规则。
   */
  private async getVisibleSectionRows(options?: ForumVisibleSectionQueryOptions) {
    const uniqueSectionIds = options?.sectionIds
      ? [...new Set(options.sectionIds)]
      : undefined

    if (uniqueSectionIds && uniqueSectionIds.length === 0) {
      return []
    }

    const sections = await this.db.query.forumSection.findMany({
      where:
        uniqueSectionIds !== undefined
          ? {
              id: { in: uniqueSectionIds },
              isEnabled: true,
              deletedAt: {
                isNull: true,
              },
            }
          : options?.groupId === undefined
            && !options?.isUngrouped
            ? {
                isEnabled: true,
                deletedAt: {
                  isNull: true,
                },
              }
            : options?.isUngrouped
              ? {
                  isEnabled: true,
                  deletedAt: {
                    isNull: true,
                  },
                  groupId: {
                    isNull: true,
                  },
                }
              : {
                  isEnabled: true,
                  deletedAt: {
                    isNull: true,
                  },
                  groupId: options.groupId,
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

    return sections
      .filter(
        (section) => this.forumPermissionService.isSectionPubliclyAvailable(section),
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

  /**
   * 将公开板块原始行映射为应用侧公开 DTO 所需字段。
   * 统一补齐访问状态与关注状态，避免多入口各自拼装。
   */
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
          ? undefined
          : accessState.accessDeniedReason,
        isFollowed: followStatusMap.get(section.id) ?? false,
      }
    })
  }

  /**
   * 批量查询公开可见板块列表项。
   * 供关注列表等聚合场景复用统一的公开 contract。
   */
  async batchGetVisibleSectionListItems(sectionIds: number[], userId?: number) {
    const sections = await this.getVisibleSectionRows({ sectionIds })
    return this.mapVisibleSectionListItems(sections, userId)
  }

  /**
   * 查询板块可见列表。
   * - 仅返回启用且未删除的板块
   * - 有分组的板块要求分组也处于启用状态
   * - 列表侧不拦截访问权限，统一返回 canAccess 与限制提示
   * - 默认按分组排序、板块排序输出，便于应用侧直接渲染
   */
  async getVisibleSectionList(query: QueryPublicForumSectionDto = {}) {
    const sections = await this.getVisibleSectionRows({
      groupId: query.groupId,
      isUngrouped: query.isUngrouped,
    })
    return this.mapVisibleSectionListItems(sections, query.userId)
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

    const { group, work, ...data } = section
    let publicGroup:
      | {
          id: number
          name: string
          description: string | null
          sortOrder: number
        }
        | undefined

    if (group) {
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
      workId: work?.id ?? null,
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
  async createSection(createSectionDto: CreateForumSectionDto) {
    const { groupId, userLevelRuleId, ...sectionData } = createSectionDto

    await this.drizzle.withTransaction(
      async (tx) => {
        if (groupId !== undefined && groupId !== null) {
          await this.lockSectionGroupsForMutation(tx, [groupId])
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
        if (userLevelRuleId !== undefined && userLevelRuleId !== null) {
          const levelRule = await tx.query.userLevelRule.findFirst({
            where: { id: userLevelRuleId },
            columns: { id: true },
          })
          if (!levelRule) {
            throw new BusinessException(
              BusinessErrorCode.RESOURCE_NOT_FOUND,
              '用户等级规则不存在',
            )
          }
        }

        await tx.insert(this.forumSection).values({
          ...sectionData,
          userLevelRuleId,
          groupId,
        })
      },
      { duplicate: '板块名称已存在' },
    )
    return true
  }

  /**
   * 获取板块分组树形结构，用于管理端板块配置页渲染。
   */
  async getSectionTree() {
    return this.forumSectionGroupService.getAdminSectionTree()
  }

  /**
   * 管理端分页查询板块列表。
   * 支持按名称模糊搜索、分组筛选、启用状态与审核策略筛选。
   * 未显式传入排序时，默认遵循板块手动排序顺序。
   */
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
      conditions.push(
        eq(this.forumSection.groupId, groupId),
      )
    }
    if (name) {
      conditions.push(buildILikeCondition(this.forumSection.name, name)!)
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '论坛板块不存在',
      )
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
  async updateSection(updateSectionDto: UpdateForumSectionDto) {
    const { id, name, groupId, ...updateData } = updateSectionDto
    await this.drizzle.withTransaction(
      async (tx) => {
        const existingSection = await tx.query.forumSection.findFirst({
          where: { id, deletedAt: { isNull: true } },
        })

        if (!existingSection) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '论坛板块不存在',
          )
        }

        if (groupId !== undefined) {
          await this.lockSectionGroupsForMutation(tx, [
            existingSection.groupId,
            groupId,
          ])
        }

        const updatePayload: Record<string, unknown> = {
          ...updateData,
        }
        if (name !== undefined) {
          updatePayload.name = name
        }

        if (
          updateData.userLevelRuleId !== undefined &&
          updateData.userLevelRuleId !== existingSection.userLevelRuleId
        ) {
          if (updateData.userLevelRuleId === null) {
            updatePayload.userLevelRuleId = null
          } else {
            const levelRule = await tx.query.userLevelRule.findFirst({
              where: { id: updateData.userLevelRuleId },
              columns: { id: true },
            })

            if (!levelRule) {
              throw new BusinessException(
                BusinessErrorCode.RESOURCE_NOT_FOUND,
                '用户等级规则不存在',
              )
            }
          }
        }

        if (
          groupId !== undefined &&
          groupId !== null &&
          groupId !== existingSection.groupId
        ) {
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
          updatePayload.groupId = groupId
        } else if (groupId === null && existingSection.groupId !== null) {
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
      { duplicate: '板块名称已存在' },
    )
    return true
  }

  /**
   * 软删除论坛板块。
   * 存在主题时禁止删除，避免孤立数据。
   */
  async deleteSection(id: number) {
    await this.drizzle.withTransaction(async (tx) => {
      await this.lockSectionForMutation(tx, id)

      const section = await tx.query.forumSection.findFirst({
        where: { id, deletedAt: { isNull: true } },
        columns: { id: true },
      })

      if (!section) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '论坛板块不存在',
        )
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

      const result = await tx
        .update(this.forumSection)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(this.forumSection.id, id),
            isNull(this.forumSection.deletedAt),
          ),
        )
      this.drizzle.assertAffectedRows(result, '论坛板块不存在')
    })
    return true
  }

  /**
   * 更新板块启用状态。
   * 写后校验受影响行数，确保板块存在。
   */
  async updateEnabledStatus(dto: UpdateForumSectionEnabledDto) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumSection)
        .set({ isEnabled: dto.isEnabled })
        .where(
          and(
            eq(this.forumSection.id, dto.id),
            isNull(this.forumSection.deletedAt),
          ),
        ),
    )
    this.drizzle.assertAffectedRows(result, '论坛板块不存在')
    return true
  }

  /**
   * 拖拽排序，交换两个板块的 sortOrder 字段。
   * 仅允许同一分组内交换；未分组板块之间允许互换。
   */
  async updateSectionSort(updateSortDto: SwapForumSectionSortDto) {
    return this.drizzle.ext.swapField(this.forumSection, {
      where: [{ id: updateSortDto.dragId }, { id: updateSortDto.targetId }],
      sourceField: 'groupId',
      recordWhere: sql`${this.forumSection.deletedAt} is null`,
    })
  }
}
