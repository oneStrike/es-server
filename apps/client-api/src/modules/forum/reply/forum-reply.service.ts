import type { ForumReplyWhereInput } from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'

import { isNotNil } from '@libs/base/utils'
import { BadRequestException, Injectable, Inject } from '@nestjs/common'
import {
  CreateForumReplyDto,
  QueryForumReplyDto,
  UpdateForumReplyDto,
} from './dto/forum-reply.dto'
import { NotificationService } from '@app/forum/notification/notification.service'
import { NotificationObjectTypeEnum } from '@app/forum/notification/notification.constant'

/**
 * 客户端论坛回复服务类
 * 提供客户端论坛回复的增删改查等核心业务逻辑
 */
@Injectable()
export class ForumReplyService extends RepositoryService {
  constructor(
    @Inject(NotificationService)
    private readonly notificationService: NotificationService,
  ) {
    super()
  }
  get forumReply() {
    return this.prisma.forumReply
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

  get forumReplyLike() {
    return this.prisma.forumReplyLike
  }

  /**
   * 创建论坛回复
   * @param createForumReplyDto 创建回复的数据
   * @param userId 用户ID
   * @returns 创建的回复信息
   */
  async createForumReply(createForumReplyDto: CreateForumReplyDto, userId: number) {
    const { topicId, replyToId, ...replyData } = createForumReplyDto

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId, isEnabled: true },
    })

    if (!topic) {
      throw new BadRequestException('主题不存在或已禁用')
    }

    if (topic.isLocked) {
      throw new BadRequestException('主题已锁定，无法回复')
    }

    const profile = await this.forumProfile.findFirst({
      where: { userId, isBanned: false },
    })

    if (!profile) {
      throw new BadRequestException('用户论坛资料不存在或已被封禁')
    }

    let replyToFloor = 0
    if (replyToId) {
      const replyTo = await this.forumReply.findUnique({
        where: { id: replyToId },
      })

      if (!replyTo) {
        throw new BadRequestException('被回复的回复不存在')
      }

      if (replyTo.topicId !== topicId) {
        throw new BadRequestException('被回复的回复不属于该主题')
      }

      replyToFloor = replyTo.floor
    }

    const maxFloor = await this.forumReply.findFirst({
      where: { topicId },
      orderBy: { floor: 'desc' },
      select: { floor: true },
    })

    const newFloor = (maxFloor?.floor ?? 0) + 1

    return this.prisma.$transaction(async (tx) => {
      const reply = await tx.forumReply.create({
        data: {
          ...replyData,
          topicId,
          userId: profile.id,
          floor: newFloor,
          replyToId,
          isHidden: true,
          auditStatus: 0,
        },
      })

      await tx.forumTopic.update({
        where: { id: topicId },
        data: {
          replyCount: {
            increment: 1,
          },
        },
      })

      await tx.forumSection.update({
        where: { id: topic.sectionId },
        data: {
          replyCount: {
            increment: 1,
          },
        },
      })

      await tx.forumProfile.update({
        where: { id: profile.id },
        data: {
          replyCount: {
            increment: 1,
          },
          points: {
            increment: 2,
          },
        },
      })

      const topicAuthor = await tx.forumProfile.findUnique({
        where: { id: topic.userId },
        include: {
          user: true,
        },
      })

      if (topicAuthor && topicAuthor.id !== profile.id) {
        await this.notificationService.createReplyNotification(
          topicAuthor.id,
          topicId,
          reply.id,
          profile.user?.nickname || profile.user?.username || '匿名用户',
          topic.title,
        )
      }

      return reply
    })
  }

  /**
   * 分页查询论坛回复列表
   * @param queryForumReplyDto 查询条件
   * @returns 分页的回复列表
   */
  async getForumReplyPage(queryForumReplyDto: QueryForumReplyDto) {
    const { content, topicId, replyToId, ...otherDto } = queryForumReplyDto

    const where: ForumReplyWhereInput = {
      isHidden: false,
      auditStatus: 1,
    }

    if (isNotNil(content)) {
      where.content = {
        contains: content,
        mode: 'insensitive',
      }
    }

    if (isNotNil(topicId)) {
      where.topicId = topicId
    }

    if (isNotNil(replyToId)) {
      where.replyToId = replyToId
    }

    return this.forumReply.findPagination({
      where,
      select: {
        id: true,
        content: true,
        topicId: true,
        userId: true,
        floor: true,
        replyToId: true,
        isHidden: true,
        auditStatus: true,
        likeCount: true,
        createdAt: true,
        updatedAt: true,
        topic: {
          select: {
            id: true,
            title: true,
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
        replyTo: {
          select: {
            id: true,
            content: true,
            floor: true,
            profile: {
              select: {
                user: {
                  select: {
                    username: true,
                    nickname: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        floor: 'asc',
      },
    })
  }

  /**
   * 获取论坛回复详情
   * @param id 回复ID
   * @returns 回复详情信息
   */
  async getForumReplyDetail(id: number) {
    const reply = await this.forumReply.findUnique({
      where: { id },
      include: {
        topic: {
          include: {
            section: true,
          },
        },
        profile: {
          include: {
            user: true,
            level: true,
            badges: true,
          },
        },
        replyTo: {
          include: {
            profile: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    })

    if (!reply) {
      throw new BadRequestException('论坛回复不存在')
    }

    return reply
  }

  /**
   * 更新论坛回复
   * @param updateForumReplyDto 更新回复的数据
   * @param userId 用户ID
   * @returns 更新后的回复信息
   */
  async updateForumReply(updateForumReplyDto: UpdateForumReplyDto, userId: number) {
    const { id, topicId, replyToId, ...updateData } = updateForumReplyDto

    const existingReply = await this.forumReply.findUnique({
      where: { id },
    })

    if (!existingReply) {
      throw new BadRequestException('论坛回复不存在')
    }

    const profile = await this.forumProfile.findFirst({
      where: { userId, id: existingReply.userId },
    })

    if (!profile) {
      throw new BadRequestException('无权修改此回复')
    }

    if (isNotNil(topicId)) {
      const topic = await this.forumTopic.findUnique({
        where: { id: topicId },
      })

      if (!topic) {
        throw new BadRequestException('主题不存在')
      }
    }

    if (isNotNil(replyToId)) {
      const replyTo = await this.forumReply.findUnique({
        where: { id: replyToId },
      })

      if (!replyTo) {
        throw new BadRequestException('被回复的回复不存在')
      }
    }

    return this.forumReply.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 删除论坛回复
   * @param id 回复ID
   * @param userId 用户ID
   * @returns 删除结果
   */
  async deleteForumReply(id: number, userId: number) {
    const reply = await this.forumReply.findUnique({
      where: { id },
    })

    if (!reply) {
      throw new BadRequestException('论坛回复不存在')
    }

    const profile = await this.forumProfile.findFirst({
      where: { userId, id: reply.userId },
    })

    if (!profile) {
      throw new BadRequestException('无权删除此回复')
    }

    const childReplyCount = await this.forumReply.count({
      where: {
        replyToId: id,
        deletedAt: null,
      },
    })

    if (childReplyCount > 0) {
      throw new BadRequestException(
        `该回复还有 ${childReplyCount} 个子回复，无法删除`,
      )
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.forumTopic.update({
        where: { id: reply.topicId },
        data: {
          replyCount: {
            decrement: 1,
          },
        },
      })

      const topic = await tx.forumTopic.findUnique({
        where: { id: reply.topicId },
        select: { sectionId: true },
      })

      if (topic) {
        await tx.forumSection.update({
          where: { id: topic.sectionId },
          data: {
            replyCount: {
              decrement: 1,
            },
          },
        })
      }

      await tx.forumProfile.update({
        where: { id: reply.userId },
        data: {
          replyCount: {
            decrement: 1,
          },
        },
      })

      return this.forumReply.softDelete({ id })
    })
  }

  /**
   * 点赞回复
   * @param id 回复ID
   * @param userId 用户ID
   * @returns 点赞结果
   */
  async likeReply(id: number, userId: number) {
    const reply = await this.forumReply.findUnique({
      where: { id },
    })

    if (!reply) {
      throw new BadRequestException('论坛回复不存在')
    }

    const profile = await this.forumProfile.findFirst({
      where: { userId, isBanned: false },
    })

    if (!profile) {
      throw new BadRequestException('用户论坛资料不存在或已被封禁')
    }

    const existingLike = await this.forumReplyLike.findFirst({
      where: {
        replyId: id,
        userId: profile.id,
      },
    })

    if (existingLike) {
      throw new BadRequestException('已经点赞过该回复')
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.forumReplyLike.create({
        data: {
          replyId: id,
          userId: profile.id,
        },
      })

      await tx.forumReply.update({
        where: { id },
        data: {
          likeCount: {
            increment: 1,
          },
        },
      })

      const replyAuthor = await tx.forumProfile.findUnique({
        where: { id: reply.userId },
        include: {
          user: true,
        },
      })

      if (replyAuthor && replyAuthor.id !== profile.id) {
        await this.notificationService.createLikeNotification(
          replyAuthor.id,
          NotificationObjectTypeEnum.REPLY,
          id,
          profile.user?.nickname || profile.user?.username || '匿名用户',
        )
      }

      return { success: true }
    })
  }

  /**
   * 取消点赞回复
   * @param id 回复ID
   * @param userId 用户ID
   * @returns 取消点赞结果
   */
  async unlikeReply(id: number, userId: number) {
    const reply = await this.forumReply.findUnique({
      where: { id },
    })

    if (!reply) {
      throw new BadRequestException('论坛回复不存在')
    }

    const profile = await this.forumProfile.findFirst({
      where: { userId, isBanned: false },
    })

    if (!profile) {
      throw new BadRequestException('用户论坛资料不存在或已被封禁')
    }

    const existingLike = await this.forumReplyLike.findFirst({
      where: {
        replyId: id,
        userId: profile.id,
      },
    })

    if (!existingLike) {
      throw new BadRequestException('未点赞过该回复')
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.forumReplyLike.delete({
        where: {
          id: existingLike.id,
        },
      })

      await tx.forumReply.update({
        where: { id },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      })

      return { success: true }
    })
  }
}
