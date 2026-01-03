import type { ForumTopicWhereInput } from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'

import { isNotNil } from '@libs/base/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateForumTopicDto,
  QueryForumTopicDto,
  UpdateForumTopicDto,
} from './dto/forum-topic.dto'

/**
 * 论坛主题服务类
 * 提供论坛主题的增删改查等核心业务逻辑
 */
@Injectable()
export class ForumTopicService extends RepositoryService {
  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumSection() {
    return this.prisma.forumSection
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  get forumTag() {
    return this.prisma.forumTag
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  /**
   * 创建论坛主题
   * @param createForumTopicDto 创建主题的数据
   * @returns 创建的主题信息
   */
  async createForumTopic(createForumTopicDto: CreateForumTopicDto) {
    const { sectionId, tagIds, ...topicData } = createForumTopicDto

    const section = await this.forumSection.findUnique({
      where: { id: sectionId, isEnabled: true },
    })

    if (!section) {
      throw new BadRequestException('板块不存在或已禁用')
    }

    const profile = await this.forumProfile.findFirst({
      where: { userId: topicData.userId, isBanned: false },
    })

    if (!profile) {
      throw new BadRequestException('用户论坛资料不存在或已被封禁')
    }

    if (tagIds && tagIds.length > 0) {
      const existingTags = await this.forumTag.findMany({
        where: {
          id: { in: tagIds },
          isEnabled: true,
        },
      })

      if (existingTags.length !== tagIds.length) {
        throw new BadRequestException('部分标签不存在或已禁用')
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const topic = await tx.forumTopic.create({
        data: {
          ...topicData,
          sectionId,
          userId: profile.id,
        },
      })

      await tx.forumSection.update({
        where: { id: sectionId },
        data: {
          topicCount: {
            increment: 1,
          },
        },
      })

      await tx.forumProfile.update({
        where: { id: profile.id },
        data: {
          topicCount: {
            increment: 1,
          },
        },
      })

      if (tagIds && tagIds.length > 0) {
        await tx.forumTopicTag.createMany({
          data: tagIds.map((tagId) => ({
            topicId: topic.id,
            tagId,
          })),
        })
      }

      return topic
    })
  }

  /**
   * 分页查询论坛主题列表
   * @param queryForumTopicDto 查询条件
   * @returns 分页的主题列表
   */
  async getForumTopicPage(queryForumTopicDto: QueryForumTopicDto) {
    const { title, sectionId, tagIds, ...otherDto } = queryForumTopicDto

    const where: ForumTopicWhereInput = {}

    if (isNotNil(title)) {
      where.title = {
        contains: title,
        mode: 'insensitive',
      }
    }

    if (isNotNil(sectionId)) {
      where.sectionId = sectionId
    }

    if (tagIds && tagIds.length > 0) {
      where.tags = {
        some: {
          tagId: {
            in: tagIds,
          },
        },
      }
    }

    return this.forumTopic.findPagination({
      where,
      select: {
        id: true,
        title: true,
        content: true,
        sectionId: true,
        userId: true,
        isPinned: true,
        isFeatured: true,
        isLocked: true,
        isHidden: true,
        auditStatus: true,
        viewCount: true,
        replyCount: true,
        likeCount: true,
        favoriteCount: true,
        createdAt: true,
        updatedAt: true,
        section: {
          select: {
            id: true,
            name: true,
          },
        },
        profile: {
          select: {
            id: true,
            userId: true,
            points: true,
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { isFeatured: 'desc' },
        { createdAt: 'desc' },
      ],
    })
  }

  /**
   * 获取论坛主题详情
   * @param id 主题ID
   * @returns 主题详情信息
   */
  async getForumTopicDetail(id: number) {
    const topic = await this.forumTopic.findUnique({
      where: { id },
      include: {
        section: true,
        profile: {
          include: {
            user: true,
            level: true,
            badges: true,
          },
        },
        tags: true,
      },
    })

    if (!topic) {
      throw new BadRequestException('论坛主题不存在')
    }

    return topic
  }

  /**
   * 更新论坛主题
   * @param updateForumTopicDto 更新主题的数据
   * @returns 更新后的主题信息
   */
  async updateForumTopic(updateForumTopicDto: UpdateForumTopicDto) {
    const { id, sectionId, tagIds, ...updateData } = updateForumTopicDto

    const existingTopic = await this.forumTopic.findUnique({
      where: { id },
    })

    if (!existingTopic) {
      throw new BadRequestException('论坛主题不存在')
    }

    if (isNotNil(sectionId)) {
      const section = await this.forumSection.findUnique({
        where: { id: sectionId, isEnabled: true },
      })

      if (!section) {
        throw new BadRequestException('板块不存在或已禁用')
      }
    }

    if (tagIds && tagIds.length > 0) {
      const existingTags = await this.forumTag.findMany({
        where: {
          id: { in: tagIds },
          isEnabled: true,
        },
      })

      if (existingTags.length !== tagIds.length) {
        throw new BadRequestException('部分标签不存在或已禁用')
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedTopic = await tx.forumTopic.update({
        where: { id },
        data: updateData,
      })

      if (tagIds !== undefined) {
        await tx.forumTopicTag.deleteMany({
          where: { topicId: id },
        })

        if (tagIds.length > 0) {
          await tx.forumTopicTag.createMany({
            data: tagIds.map((tagId) => ({
              topicId: id,
              tagId,
            })),
          })
        }
      }

      return updatedTopic
    })
  }

  /**
   * 软删除论坛主题
   * @param id 主题ID
   * @returns 删除结果
   */
  async deleteForumTopic(id: number) {
    const topic = await this.forumTopic.findUnique({
      where: { id },
    })

    if (!topic) {
      throw new BadRequestException('论坛主题不存在')
    }

    const replyCount = await this.forumReply.count({
      where: {
        topicId: id,
        deletedAt: null,
      },
    })

    if (replyCount > 0) {
      throw new BadRequestException(
        `该主题还有 ${replyCount} 个回复，无法删除`,
      )
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.forumSection.update({
        where: { id: topic.sectionId },
        data: {
          topicCount: {
            decrement: 1,
          },
        },
      })

      await tx.forumProfile.update({
        where: { id: topic.userId },
        data: {
          topicCount: {
            decrement: 1,
          },
        },
      })

      return this.forumTopic.softDelete({ id })
    })
  }

  /**
   * 更新主题置顶状态
   * @param id 主题ID
   * @param isPinned 是否置顶
   * @returns 更新结果
   */
  async updatePinnedStatus(id: number, isPinned: boolean) {
    const topic = await this.forumTopic.findUnique({
      where: { id },
    })

    if (!topic) {
      throw new BadRequestException('论坛主题不存在')
    }

    return this.forumTopic.update({
      where: { id },
      data: { isPinned },
    })
  }

  /**
   * 更新主题加精状态
   * @param id 主题ID
   * @param isFeatured 是否加精
   * @returns 更新结果
   */
  async updateFeaturedStatus(id: number, isFeatured: boolean) {
    const topic = await this.forumTopic.findUnique({
      where: { id },
    })

    if (!topic) {
      throw new BadRequestException('论坛主题不存在')
    }

    return this.forumTopic.update({
      where: { id },
      data: { isFeatured },
    })
  }

  /**
   * 更新主题锁定状态
   * @param id 主题ID
   * @param isLocked 是否锁定
   * @returns 更新结果
   */
  async updateLockedStatus(id: number, isLocked: boolean) {
    const topic = await this.forumTopic.findUnique({
      where: { id },
    })

    if (!topic) {
      throw new BadRequestException('论坛主题不存在')
    }

    return this.forumTopic.update({
      where: { id },
      data: { isLocked },
    })
  }

  /**
   * 更新主题审核状态
   * @param id 主题ID
   * @param auditStatus 审核状态
   * @returns 更新结果
   */
  async updateAuditStatus(id: number, auditStatus: number) {
    const topic = await this.forumTopic.findUnique({
      where: { id },
    })

    if (!topic) {
      throw new BadRequestException('论坛主题不存在')
    }

    return this.forumTopic.update({
      where: { id },
      data: { auditStatus },
    })
  }
}
