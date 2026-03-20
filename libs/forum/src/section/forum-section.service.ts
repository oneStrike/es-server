import type {
  CreateForumSectionInput,
  QueryForumSectionInput,
  SwapForumSectionSortInput,
  UpdateForumSectionEnabledInput,
  UpdateForumSectionInput,
} from './section.type'
import { DrizzleService } from '@db/core'

import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, ilike, isNull } from 'drizzle-orm'

/**
 * 论坛板块服务类
 * 提供论坛板块的增删改查等核心业务逻辑
 */
@Injectable()
export class ForumSectionService {
  constructor(private readonly drizzle: DrizzleService) {}

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
          columns: { replyCount: true },
        },
      },
    })

    if (!section) {
      return { topicCount: 0, replyCount: 0 }
    }

    const totalReplyCount = section.topics.reduce(
      (sum, topic) => sum + topic.replyCount,
      0,
    )

    return {
      topicCount: section.topics.length,
      replyCount: totalReplyCount,
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
