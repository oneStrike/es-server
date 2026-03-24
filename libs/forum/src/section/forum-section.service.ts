import type {
  CreateForumSectionInput,
  QueryForumSectionInput,
  QueryPublicForumSectionInput,
  SwapForumSectionSortInput,
  UpdateForumSectionEnabledInput,
  UpdateForumSectionInput,
} from './section.type'
import { DrizzleService } from '@db/core'
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
 * 论坛板块服务类
 * 提供论坛板块的增删改查等核心业务逻辑
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
   * 判断公开板块挂载的分组是否仍可对外展示。
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
   * 查询当前用户可访问的公开板块列表。
   * - 仅返回启用且未删除的板块
   * - 有分组的板块要求分组也处于启用状态
   * - 默认按分组排序、板块排序输出，便于应用侧直接渲染
   */
  async getPublicSectionList(query: QueryPublicForumSectionInput = {}) {
    const accessibleSectionIds =
      await this.forumPermissionService.getAccessibleSectionIds(query.userId)

    if (accessibleSectionIds.length === 0) {
      return []
    }

    const sections = await this.db.query.forumSection.findMany({
      where: {
        id: {
          in: accessibleSectionIds,
        },
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

    if (!query.userId || visibleSections.length === 0) {
      return visibleSections.map((section) => ({
        ...section,
        isFollowed: false,
      }))
    }

    const followStatusMap = await this.followService.checkStatusBatch(
      FollowTargetTypeEnum.FORUM_SECTION,
      visibleSections.map((section) => section.id),
      query.userId,
    )

    return visibleSections.map((section) => ({
      ...section,
      isFollowed: followStatusMap.get(section.id) ?? false,
    }))
  }

  /**
   * 查询公开板块详情。
   * 详情访问复用板块权限校验，避免绕过等级限制读取板块信息。
   */
  async getPublicSectionDetail(id: number, userId?: number) {
    await this.forumPermissionService.ensureUserCanAccessSection(id, userId, {
      requireEnabled: true,
      notFoundMessage: '板块不存在',
    })

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

    const followStatus = userId
      ? await this.followService.checkFollowStatus({
          targetType: FollowTargetTypeEnum.FORUM_SECTION,
          targetId: id,
          userId,
        })
      : undefined

    return {
      ...data,
      group: publicGroup,
      isFollowed: followStatus?.isFollowing ?? false,
    }
  }

  /**
   * 计算板块统计信息
   * @param sectionId 板块ID
   * @returns 统计信息对象
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
   * 创建论坛板块
   * @param createSectionDto 创建板块的数据
   * @returns 创建的板块信息
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
   * 获取板块列表
   * @returns 板块列表
   */
  async getSectionTree() {
    return this.db.query.forumSectionGroup.findMany({
      where: {
        deletedAt: { isNull: true },
      },
      orderBy: (group, { asc }) => [asc(group.sortOrder)],
    })
  }

  /**
   * 分页查询论坛板块列表
   * @param queryForumSectionDto 查询条件
   * @returns 分页的板块列表
   */
  async getSectionPage(queryForumSectionDto: QueryForumSectionInput) {
    const { name, groupId, ...otherDto } = queryForumSectionDto
    const where = this.drizzle.buildWhere(this.forumSection, {
      and: {
        ...otherDto,
        deletedAt: { isNull: true },
        groupId,
      },
      ...(name ? { or: [ilike(this.forumSection.name, `%${name}%`)] } : {}),
    })

    return this.drizzle.ext.findPagination(this.forumSection, {
      where,
      ...otherDto,
    })
  }

  /**
   * 获取论坛板块详情
   * @param id 板块ID
   * @returns 板块详情信息
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
   * 更新论坛板块
   * @param updateSectionDto 更新板块的数据
   * @returns 更新后的板块信息
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
   * 软删除论坛板块
   * @param id 板块ID
   * @returns 删除结果
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
   * 更新板块启用状态
   * @param dto 更新状态数据
   * @returns 更新结果
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
   * 拖拽排序
   * @param updateSortDto 排序数据
   * @returns 排序结果
   */
  async updateSectionSort(updateSortDto: SwapForumSectionSortInput) {
    return this.drizzle.ext.swapField(this.forumSection, {
      where: [{ id: updateSortDto.dragId }, { id: updateSortDto.targetId }],
      sourceField: 'sortOrder',
    })
  }
}
