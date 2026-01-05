import type { ForumSectionWhereInput } from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'

import { DragReorderDto } from '@libs/base/dto'
import { isNotNil } from '@libs/base/utils'
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
export class ForumSectionService extends RepositoryService {
  get forumSection() {
    return this.prisma.forumSection
  }

  /**
   * 计算板块路径
   * @param parentId 父板块ID
   * @returns 板块路径字符串
   */
  private async calculateSectionPath(parentId: number | null) {
    if (!parentId) {
      return '/'
    }

    const parentSection = await this.forumSection.findUnique({
      where: { id: parentId },
      select: { path: true, level: true },
    })

    if (!parentSection) {
      return '/'
    }

    const maxLevel = 2
    if (parentSection.level >= maxLevel) {
      throw new BadRequestException('板块层级只允许存在2级（包含主板块）')
    }

    return `${parentSection.path}${parentId}/`
  }

  /**
   * 验证是否存在循环引用
   * @param parentId 父板块ID
   * @param childId 子板块ID
   * @returns 是否存在循环引用
   */
  private async validateNoCircularReference(parentId: number, childId: number) {
    if (parentId === childId) {
      return false
    }

    const childSection = await this.forumSection.findUnique({
      where: { id: childId },
      select: { parentId: true },
    })

    if (!childSection?.parentId) {
      return true
    }

    return this.validateNoCircularReference(parentId, childSection.parentId)
  }

  /**
   * 获取父板块信息
   * @param parentId 父板块ID
   * @returns 父板块信息
   */
  private async getParentSection(parentId: number) {
    return this.forumSection.findUnique({
      where: { id: parentId },
    })
  }

  /**
   * 计算板块统计信息（包含子板块）
   * @param sectionId 板块ID
   * @returns 统计信息对象
   */
  private async calculateStatistics(sectionId: number) {
    const section = await this.forumSection.findUnique({
      where: { id: sectionId },
      include: {
        children: {
          where: { deletedAt: null },
          select: { id: true },
        },
        topics: {
          where: { deletedAt: null },
          select: { replyCount: true },
        },
      },
    })

    if (!section) {
      return { topicCount: 0, replyCount: 0 }
    }

    let totalReplyCount = section.topics.reduce(
      (sum, topic) => sum + topic.replyCount,
      0,
    )

    for (const child of section.children) {
      const childStats = await this.calculateStatistics(child.id)
      totalReplyCount += childStats.replyCount
    }

    return {
      topicCount: section.topics.length,
      replyCount: totalReplyCount,
    }
  }

  /**
   * 创建论坛板块
   * @param createForumSectionDto 创建板块的数据
   * @returns 创建的板块信息
   */
  async createForumSection(createForumSectionDto: CreateForumSectionDto) {
    const { name, parentId, ...sectionData } = createForumSectionDto

    const existingSection = await this.forumSection.findFirst({
      where: { name, deletedAt: null },
    })

    if (existingSection) {
      throw new BadRequestException('板块名称已存在')
    }

    if (parentId) {
      const parentSection = await this.getParentSection(parentId)
      if (!parentSection) {
        throw new BadRequestException('父板块不存在')
      }
    }

    const path = await this.calculateSectionPath(parentId || null)
    const level = parentId
      ? (await this.getParentSection(parentId))!.level + 1
      : 0

    return this.forumSection.create({
      data: {
        name,
        parentId: parentId || null,
        level,
        path,
        ...sectionData,
      },
    })
  }

  /**
   * 移动板块到新的父板块
   * @param id 板块ID
   * @param newParentId 新的父板块ID
   * @returns 更新后的板块信息
   */
  async moveSection(id: number, newParentId: number | null) {
    const section = await this.forumSection.findUnique({
      where: { id },
      include: {
        children: {
          select: { id: true },
        },
      },
    })

    if (!section) {
      throw new BadRequestException('板块不存在')
    }

    if (newParentId) {
      const targetSection = await this.getParentSection(newParentId)
      if (!targetSection) {
        throw new BadRequestException('目标父板块不存在')
      }

      const isCircular = await this.validateNoCircularReference(id, newParentId)
      if (!isCircular) {
        throw new BadRequestException('不能将板块移动到其子板块下')
      }
    }

    const newPath = await this.calculateSectionPath(newParentId || null)
    const newLevel = newParentId
      ? (await this.getParentSection(newParentId))!.level + 1
      : 0

    await this.forumSection.update({
      where: { id },
      data: {
        parentId: newParentId || null,
        level: newLevel,
        path: newPath,
      },
    })

    for (const child of section.children) {
      await this.updateChildSectionPath(child.id, newPath, newLevel)
    }

    return { id }
  }

  /**
   * 递归更新子板块路径和层级
   * @param childId 子板块ID
   * @param parentPath 父板块路径
   * @param parentLevel 父板块层级
   */
  private async updateChildSectionPath(
    childId: number,
    parentPath: string,
    parentLevel: number,
  ): Promise<void> {
    const child = await this.forumSection.findUnique({
      where: { id: childId },
      include: {
        children: {
          select: { id: true },
        },
      },
    })

    if (!child) {
      return
    }

    const newPath = `${parentPath}${childId}/`
    const newLevel = parentLevel + 1

    await this.forumSection.update({
      where: { id: childId },
      data: {
        level: newLevel,
        path: newPath,
      },
    })

    for (const grandChild of child.children) {
      await this.updateChildSectionPath(grandChild.id, newPath, newLevel)
    }
  }

  /**
   * 获取板块树结构
   * @param rootOnly 是否只获取主板块
   * @returns 板块树结构
   */
  async getSectionTree(rootOnly: boolean = true) {
    const whereCondition: ForumSectionWhereInput = {
      deletedAt: null,
    }

    if (rootOnly) {
      whereCondition.parentId = null
    }

    const sections = await this.forumSection.findMany({
      where: whereCondition,
      orderBy: {
        sortOrder: 'asc',
      },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: {
            sortOrder: 'asc',
          },
          include: {
            children: {
              where: { deletedAt: null },
              orderBy: {
                sortOrder: 'asc',
              },
            },
          },
        },
      },
    })

    return sections
  }

  /**
   * 分页查询论坛板块列表
   * @param queryForumSectionDto 查询条件
   * @returns 分页的板块列表
   */
  async getForumSectionPage(queryForumSectionDto: QueryForumSectionDto) {
    const { name, ...otherDto } = queryForumSectionDto

    const where: ForumSectionWhereInput = {
      deletedAt: null,
      ...otherDto,
    }

    if (name) {
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
        parentId: true,
        level: true,
        path: true,
        description: true,
        icon: true,
        sortOrder: true,
        isEnabled: true,
        inheritPermission: true,
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
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            level: true,
            topicCount: true,
            replyCount: true,
          },
        },
      },
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
    const { id, name, parentId, ...updateData } = updateForumSectionDto

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
          deletedAt: null,
        },
      })
      if (duplicateSection) {
        throw new BadRequestException('板块名称已存在')
      }
    }

    if (isNotNil(parentId) && parentId !== existingSection.parentId) {
      if (parentId === id) {
        throw new BadRequestException('不能将板块设置为自己的父板块')
      }

      const targetSection = await this.getParentSection(parentId)
      if (!targetSection) {
        throw new BadRequestException('目标父板块不存在')
      }

      const isCircular = await this.validateNoCircularReference(id, parentId)
      if (!isCircular) {
        throw new BadRequestException('不能将板块移动到其子板块下')
      }

      const newPath = await this.calculateSectionPath(parentId)
      const newLevel = targetSection.level + 1

      await this.forumSection.update({
        where: { id },
        data: {
          parentId,
          level: newLevel,
          path: newPath,
        },
      })

      const children = await this.forumSection.findMany({
        where: { parentId: id },
        select: { id: true },
      })

      for (const child of children) {
        await this.updateChildSectionPath(child.id, newPath, newLevel)
      }
    }

    return this.forumSection.update({
      where: { id },
      data: {
        name,
        ...updateData,
      },
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
      include: {
        children: {
          where: { deletedAt: null },
        },
      },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    if (section.children.length > 0) {
      throw new BadRequestException('请先删除该板块下的子板块')
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

  /**
   * 刷新板块统计信息
   * @param id 板块ID
   * @returns 更新后的统计信息
   */
  async refreshSectionStatistics(id: number) {
    const section = await this.forumSection.findUnique({
      where: { id },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    const stats = await this.calculateStatistics(id)

    return this.forumSection.update({
      where: { id },
      data: {
        topicCount: stats.topicCount,
        replyCount: stats.replyCount,
      },
    })
  }
}
