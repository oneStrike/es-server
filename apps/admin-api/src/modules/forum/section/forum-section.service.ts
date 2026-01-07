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

@Injectable()
export class ForumSectionService extends RepositoryService {
  get forumSection() {
    return this.prisma.forumSection
  }

  async createForumSection(createForumSectionDto: CreateForumSectionDto) {
    const { name, groupId, ...sectionData } = createForumSectionDto

    const existingSection = await this.forumSection.findFirst({
      where: { name, deletedAt: null },
    })

    if (existingSection) {
      throw new BadRequestException('板块名称已存在')
    }

    if (groupId) {
      const group = await this.prisma.forumSectionGroup.findUnique({
        where: { id: groupId },
      })
      if (!group) {
        throw new BadRequestException('板块分组不存在')
      }
    }

    return this.forumSection.create({
      data: {
        name,
        groupId: groupId || null,
        ...sectionData,
      },
    })
  }

  async getSectionTree(rootOnly: boolean = true) {
    const groups = await this.prisma.forumSectionGroup.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        sortOrder: 'asc',
      },
      include: {
        sections: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            sortOrder: 'asc',
          },
          select: {
            id: true,
            name: true,
            groupId: true,
            description: true,
            icon: true,
            sortOrder: true,
            isEnabled: true,
            topicCount: true,
            replyCount: true,
            lastPostAt: true,
            lastTopicId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
        isEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return groups
  }

  async getForumSectionPage(queryForumSectionDto: QueryForumSectionDto) {
    const { name, groupId, ...otherDto } = queryForumSectionDto

    const where: ForumSectionWhereInput = {
      deletedAt: null,
    }

    if (isNotNil(name)) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      }
    }

    if (isNotNil(groupId)) {
      where.groupId = groupId
    }

    return this.forumSection.findPagination({
      where,
      select: {
        id: true,
        name: true,
        groupId: true,
        description: true,
        icon: true,
        sortOrder: true,
        isEnabled: true,
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

  async getForumSectionDetail(id: number) {
    const section = await this.forumSection.findUnique({
      where: { id },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    return section
  }

  async updateForumSection(updateForumSectionDto: UpdateForumSectionDto) {
    const { id, name, groupId, ...updateData } = updateForumSectionDto

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

    if (isNotNil(groupId)) {
      const group = await this.prisma.forumSectionGroup.findUnique({
        where: { id: groupId },
      })
      if (!group) {
        throw new BadRequestException('板块分组不存在')
      }
    }

    return this.forumSection.update({
      where: { id },
      data: {
        name,
        groupId,
        ...updateData,
      },
    })
  }

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

  async updateSectionSort(updateSortDto: DragReorderDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.forumSection.swapField(
        { id: updateSortDto.dragId },
        { id: updateSortDto.targetId },
        'sortOrder',
      )
    })
  }

  async refreshSectionStatistics(id: number) {
    const section = await this.forumSection.findUnique({
      where: { id },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    const topicCount = await this.prisma.forumTopic.count({
      where: { sectionId: id, deletedAt: null },
    })

    const topics = await this.prisma.forumTopic.findMany({
      where: { sectionId: id, deletedAt: null },
      select: { replyCount: true },
    })

    const replyCount = topics.reduce((sum, topic) => sum + topic.replyCount, 0)

    return this.forumSection.update({
      where: { id },
      data: {
        topicCount,
        replyCount,
      },
    })
  }
}
