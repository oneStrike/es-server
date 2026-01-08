import type { ForumTopicWhereInput } from '@libs/base/database'

import { BaseService } from '@libs/base/database'
import { isNotNil } from '@libs/base/utils'
import { NotificationService } from '@libs/forum/notification/notification.service'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import {
  CreateForumTopicDto,
  QueryForumTopicDto,
  UpdateForumTopicDto,
} from './dto/forum-topic.dto'

/**
 * 客户端论坛主题服务类
 * 提供客户端论坛主题查询业务逻辑
 */
@Injectable()
export class ForumTopicService extends BaseService {
  constructor(
    @Inject(NotificationService)
    private readonly notificationService: NotificationService,
  ) {
    super()
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumSection() {
    return this.prisma.forumSection
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  get forumTopicLike() {
    return this.prisma.forumTopicLike
  }

  get forumTopicFavorite() {
    return this.prisma.forumTopicFavorite
  }

  /**
   * 分页查询论坛主题列表
   * @param queryForumTopicDto 查询条件
   * @returns 分页的主题列表
   */
  async getForumTopicPage(queryForumTopicDto: QueryForumTopicDto) {
    const { title, sectionId, tagIds, ...otherDto } = queryForumTopicDto

    const where: ForumTopicWhereInput = {
      isHidden: false,
      auditStatus: 2,
    }

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
          id: {
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
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatar: true,
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
        user: true,
        tags: true,
      },
    })

    if (!topic) {
      throw new BadRequestException('论坛主题不存在')
    }

    if (topic.isHidden) {
      throw new BadRequestException('论坛主题已隐藏')
    }

    if (topic.auditStatus !== 2) {
      throw new BadRequestException('论坛主题未通过审核')
    }

    await this.forumTopic.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })

    return topic
  }

  /**
   * 点赞主题
   * @param topicId 主题ID
   * @param userId 用户ID
   * @param isLike 是否点赞
   * @returns 操作结果
   */
  async likeTopic(topicId: number, userId: number, isLike: boolean) {
    const topic = await this.forumTopic.findUnique({
      where: { id: topicId },
    })

    if (!topic) {
      throw new BadRequestException('论坛主题不存在')
    }

    if (topic.isHidden) {
      throw new BadRequestException('论坛主题已隐藏')
    }

    if (topic.auditStatus !== 2) {
      throw new BadRequestException('论坛主题未通过审核')
    }

    const profile = await this.forumProfile.findFirst({
      where: { userId, status: 1 },
    })

    if (!profile) {
      throw new BadRequestException('用户论坛资料不存在或已被封禁')
    }

    const existingLike = await this.forumTopicLike.findFirst({
      where: {
        topicId,
        userId: profile.id,
      },
    })

    return this.prisma.$transaction(async (tx) => {
      if (isLike) {
        if (existingLike) {
          throw new BadRequestException('已经点赞过该主题')
        }

        await tx.forumTopicLike.create({
          data: {
            topicId,
            userId: profile.id,
          },
        })

        await tx.forumTopic.update({
          where: { id: topicId },
          data: {
            likeCount: {
              increment: 1,
            },
          },
        })

        await tx.forumProfile.update({
          where: { id: profile.id },
          data: {
            points: {
              increment: 1,
            },
          },
        })
      } else {
        if (!existingLike) {
          throw new BadRequestException('未点赞过该主题')
        }

        await tx.forumTopicLike.deleteMany({
          where: {
            topicId,
            userId: profile.id,
          },
        })

        await tx.forumTopic.update({
          where: { id: topicId },
          data: {
            likeCount: {
              decrement: 1,
            },
          },
        })

        await tx.forumProfile.update({
          where: { id: profile.id },
          data: {
            points: {
              decrement: 1,
            },
          },
        })
      }

      return { success: true }
    })
  }

  /**
   * 收藏主题
   * @param topicId 主题ID
   * @param userId 用户ID
   * @param isFavorite 是否收藏
   * @returns 操作结果
   */
  async favoriteTopic(topicId: number, userId: number, isFavorite: boolean) {
    const topic = await this.forumTopic.findUnique({
      where: { id: topicId },
    })

    if (!topic) {
      throw new BadRequestException('论坛主题不存在')
    }

    if (topic.isHidden) {
      throw new BadRequestException('论坛主题已隐藏')
    }

    if (topic.auditStatus !== 2) {
      throw new BadRequestException('论坛主题未通过审核')
    }

    const profile = await this.forumProfile.findFirst({
      where: { userId, status: 1 },
    })

    if (!profile) {
      throw new BadRequestException('用户论坛资料不存在或已被封禁')
    }

    const existingFavorite = await this.forumTopicFavorite.findFirst({
      where: {
        topicId,
        userId: profile.id,
      },
    })

    return this.prisma.$transaction(async (tx) => {
      if (isFavorite) {
        if (existingFavorite) {
          throw new BadRequestException('已经收藏过该主题')
        }

        await tx.forumTopicFavorite.create({
          data: {
            topicId,
            userId: profile.id,
          },
        })

        await tx.forumTopic.update({
          where: { id: topicId },
          data: {
            favoriteCount: {
              increment: 1,
            },
          },
        })
      } else {
        if (!existingFavorite) {
          throw new BadRequestException('未收藏过该主题')
        }

        await tx.forumTopicFavorite.deleteMany({
          where: {
            topicId,
            userId: profile.id,
          },
        })

        await tx.forumTopic.update({
          where: { id: topicId },
          data: {
            favoriteCount: {
              decrement: 1,
            },
          },
        })
      }

      return { success: true }
    })
  }

  /**
   * 创建论坛主题
   * @param createForumTopicDto 创建主题的数据
   * @param userId 用户ID
   * @returns 创建的主题信息
   */
  async createForumTopic(
    createForumTopicDto: CreateForumTopicDto,
    userId: number,
  ) {
    const { sectionId, tagIds, ...topicData } = createForumTopicDto

    const section = await this.forumSection.findUnique({
      where: { id: sectionId, isEnabled: true },
    })

    if (!section) {
      throw new BadRequestException('板块不存在或已禁用')
    }

    const profile = await this.forumProfile.findFirst({
      where: { userId, status: 1 },
    })

    if (!profile) {
      throw new BadRequestException('用户论坛资料不存在或已被封禁')
    }

    if (tagIds && tagIds.length > 0) {
      const existingTags = await this.prisma.forumTag.findMany({
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
          isHidden: true,
          auditStatus: 0,
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
          points: {
            increment: 5,
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
   * 更新论坛主题
   * @param updateForumTopicDto 更新主题的数据
   * @param userId 用户ID
   * @returns 更新后的主题信息
   */
  async updateForumTopic(
    updateForumTopicDto: UpdateForumTopicDto,
    userId: number,
  ) {
    const { id, sectionId, tagIds, ...updateData } = updateForumTopicDto

    const existingTopic = await this.forumTopic.findUnique({
      where: { id },
      include: {
        user: true,
      },
    })

    if (!existingTopic) {
      throw new BadRequestException('论坛主题不存在')
    }

    if (existingTopic.user.id !== userId) {
      throw new BadRequestException('无权编辑该主题')
    }

    if (existingTopic.isLocked) {
      throw new BadRequestException('主题已锁定，无法编辑')
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
      const existingTags = await this.prisma.forumTag.findMany({
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
        data: {
          ...updateData,
          isHidden: true,
          auditStatus: 0,
        },
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
   * 删除论坛主题
   * @param id 主题ID
   * @param userId 用户ID
   * @returns 删除结果
   */
  async deleteForumTopic(id: number, userId: number) {
    const topic = await this.forumTopic.findUnique({
      where: { id },
      include: {
        user: true,
      },
    })

    if (!topic) {
      throw new BadRequestException('论坛主题不存在')
    }

    if (topic.user.id !== userId) {
      throw new BadRequestException('无权删除该主题')
    }

    if (topic.isLocked) {
      throw new BadRequestException('主题已锁定，无法删除')
    }

    const replyCount = await this.forumReply.count({
      where: {
        topicId: id,
        deletedAt: null,
      },
    })

    if (replyCount > 0) {
      throw new BadRequestException(`该主题还有 ${replyCount} 个回复，无法删除`)
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
          points: {
            decrement: 5,
          },
        },
      })

      return this.forumTopic.softDelete({ id })
    })
  }
}
