import type { ForumSectionWhereInput } from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'

import { isNotNil } from '@libs/base/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { DragReorderDto } from '@libs/base/dto'
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
export class ForumSectionService extends RepositoryService {
  get forumSection() {
    return this.prisma.forumSection
  }

  /**
   * 创建论坛板块
   * @param createForumSectionDto 创建板块的数据
   * @returns 创建的板块信息
   */
  async createForumSection(createForumSectionDto: CreateForumSectionDto) {
    const { name, ...sectionData } = createForumSectionDto

    const existingSection = await this.forumSection.findFirst({
      where: { name },
    })

    if (existingSection) {
      throw new BadRequestException('板块名称已存在')
    }

    return this.forumSection.create({
      data: sectionData,
    })
  }

  /**
   * 分页查询论坛板块列表
   * @param queryForumSectionDto 查询条件
   * @returns 分页的板块列表
   */
  async getForumSectionPage(queryForumSectionDto: QueryForumSectionDto) {
    const { name, ...otherDto } = queryForumSectionDto

    const where: ForumSectionWhereInput = {}

    if (isNotNil(name)) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      }
    }

    return this.forumSection.findPagination({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        sortOrder: true,
        isEnabled: true,
        requireAudit: true,
        topicCount: true,
        replyCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })
  }

  /**
   * 获取论坛板块详情
   * @param id 板块ID
   * @returns 板块详情信息
   */
  async getForumSectionDetail(id: number) {
    const section = await this.forumSection.findUnique({
      where: { id },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    return section
  }

  /**
   * 更新论坛板块
   * @param updateForumSectionDto 更新板块的数据
   * @returns 更新后的板块信息
   */
  async updateForumSection(updateForumSectionDto: UpdateForumSectionDto) {
    const { id, name, ...updateData } = updateForumSectionDto

    const existingSection = await this.forumSection.findUnique({
      where: { id },
    })

    if (!existingSection) {
      throw new BadRequestException('论坛板块不存在')
    }

    if (isNotNil(name) && name !== existingSection.name) {
      const duplicateSection = await this.forumSection.findFirst({
        where: {
          name,
          id: { not: id },
        },
      })
      if (duplicateSection) {
        throw new BadRequestException('板块名称已存在')
      }
    }

    return this.forumSection.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 软删除论坛板块
   * @param id 板块ID
   * @returns 删除结果
   */
  async deleteForumSection(id: number) {
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
   * @param id 板块ID
   * @param isEnabled 是否启用
   * @returns 更新结果
   */
  async updateEnabledStatus(id: number, isEnabled: boolean) {
    const section = await this.forumSection.findUnique({
      where: { id },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    return this.forumSection.update({
      where: { id },
      data: { isEnabled },
    })
  }

  /**
   * 更新板块排序
   * @param id 板块ID
   * @param sortOrder 排序权重
   * @returns 更新结果
   */
  async updateSortOrder(id: number, sortOrder: number) {
    const section = await this.forumSection.findUnique({
      where: { id },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    return this.forumSection.update({
      where: { id },
      data: { sortOrder },
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
