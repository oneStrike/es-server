import { BaseService } from '@libs/base/database'
import { DragReorderDto, UpdateEnabledStatusDto } from '@libs/base/dto'

import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateForumSectionDto,
  QueryForumSectionDto,
  UpdateForumSectionDto,
} from './dto/forum-section.dto'

/**
 * 论坛板块服务类
 * 提供论坛板块的增删改查等核心业务逻辑
 */
@Injectable()
export class ForumSectionService extends BaseService {
  get forumSection() {
    return this.prisma.forumSection
  }

  get forumSectionGroup() {
    return this.prisma.forumSectionGroup
  }

  get forumLevelRule() {
    return this.prisma.appLevelRule
  }

  /**
   * 计算板块统计信息
   * @param sectionId 板块ID
   * @returns 统计信息对象
   */
  private async calculateStatistics(sectionId: number) {
    const section = await this.forumSection.findUnique({
      where: { id: sectionId },
      include: {
        topics: {
          where: { deletedAt: null },
          select: { replyCount: true },
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
  async createSection(createSectionDto: CreateForumSectionDto) {
    const { name, groupId, userLevelRuleId, ...sectionData } =
      createSectionDto

    if (!(await this.forumSection.exists({ name, deletedAt: null }))) {
      throw new BadRequestException('板块名称已存在')
    }

    if (groupId) {
      if (
        !(await this.forumSectionGroup.exists({ id: groupId, deletedAt: null }))
      ) {
        throw new BadRequestException('板块分组不存在')
      }
    }
    if (userLevelRuleId) {
      if (
        !(await this.forumLevelRule.exists({
          id: userLevelRuleId,
        }))
      ) {
        throw new BadRequestException('用户等级规则不存在')
      }
    }

    return this.forumSection.create({
      data: {
        name,
        ...sectionData,
        userLevelRule: {
          connect: {
            id: userLevelRuleId,
          },
        },
        group: {
          connect: {
            id: groupId,
          },
        },
      },
    })
  }

  /**
   * 获取板块列表
   * @returns 板块列表
   */
  async getSectionTree() {
    return this.forumSectionGroup.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })
  }

  /**
   * 分页查询论坛板块列表
   * @param queryForumSectionDto 查询条件
   * @returns 分页的板块列表
   */
  async getSectionPage(queryForumSectionDto: QueryForumSectionDto) {
    const { name, groupId, ...otherDto } = queryForumSectionDto

    return this.forumSection.findPagination({
      where: {
        name: {
          contains: name,
          mode: 'insensitive',
        },
        group: {
          id: groupId,
        },
        ...otherDto,
        deletedAt: null,
      },
    })
  }

  /**
   * 获取论坛板块详情
   * @param id 板块ID
   * @returns 板块详情信息
   */
  async getSectionDetail(id: number) {
    const section = await this.forumSection.findUnique({
      where: { id },
      include: {
        group: true,
      },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    return section
  }

  /**
   * 更新论坛板块
   * @param updateSectionDto 更新板块的数据
   * @returns 更新后的板块信息
   */
  async updateSection(updateSectionDto: UpdateForumSectionDto) {
    const { id, name, groupId, ...updateData } = updateSectionDto

    const existingSection = await this.forumSection.findUnique({
      where: { id },
    })

    if (!existingSection) {
      throw new BadRequestException('论坛板块不存在')
    }

    if (name && name !== existingSection.name) {
      const duplicateSection = await this.forumSection.findFirst({
        where: {
          name,
          id: { not: id },
          deletedAt: null,
        },
      })
      if (duplicateSection) {
        throw new BadRequestException('板块名称已存在')
      }
    }

    const updatePayload: any = {
      name,
      ...updateData,
    }

    if (groupId && groupId !== existingSection.groupId) {
      if (!(await this.forumSectionGroup.exists({ id: groupId }))) {
        throw new BadRequestException('板块分组不存在')
      }
      updatePayload.group = { connect: { id: groupId } }
    } else if (groupId === null && existingSection.groupId !== null) {
      updatePayload.group = { disconnect: true }
    }

    return this.forumSection.update({
      where: { id },
      data: updatePayload,
    })
  }

  /**
   * 软删除论坛板块
   * @param id 板块ID
   * @returns 删除结果
   */
  async deleteSection(id: number) {
    const section = await this.forumSection.findUnique({
      where: { id },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    if (section.topicCount > 0) {
      throw new BadRequestException(
        `该板块还有 ${section.topicCount} 个主题，无法删除`,
      )
    }

    return this.forumSection.softDelete({ id })
  }

  /**
   * 更新板块启用状态
   * @param dto 更新状态数据
   * @returns 更新结果
   */
  async updateEnabledStatus(dto: UpdateEnabledStatusDto) {
    if (!(await this.forumSection.exists({ id: dto.id }))) {
      throw new BadRequestException('论坛板块不存在')
    }

    return this.forumSection.update({
      where: { id: dto.id },
      data: { isEnabled: dto.isEnabled },
    })
  }

  /**
   * 拖拽排序
   * @param updateSortDto 排序数据
   * @returns 排序结果
   */
  async updateSectionSort(updateSortDto: DragReorderDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.forumSection.swapField(
        { id: updateSortDto.dragId },
        { id: updateSortDto.targetId },
        'sortOrder',
      )
    })
  }
}
