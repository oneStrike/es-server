import { BaseService } from '@libs/base/database'

import { UserGrowthEventService } from '@libs/user/growth-event'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumGrowthEventKey } from '../forum-growth-event.constant'
import {
  CreateForumReplyLikeDto,
  DeleteForumReplyLikeDto,
} from './dto/forum-reply-like.dto'

/**
 * 论坛回复点赞服务类
 * 提供论坛回复点赞的创建、删除等核心业务逻辑
 */
@Injectable()
export class ForumReplyLikeService extends BaseService {
  constructor(
    private readonly actionLogService: ForumUserActionLogService,
    private readonly userGrowthEventService: UserGrowthEventService,
  ) {
    super()
  }

  get forumReplyLike() {
    return this.prisma.forumReplyLike
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  // get forumProfile() {
  //   return this.prisma.forumProfile
  // }

  /**
   * 点赞回复
   * @param createForumReplyLikeDto - 创建点赞记录的数据传输对象
   * @returns 创建的点赞记录
   * @throws {BadRequestException} 回复不存在时抛出
   * @throws {BadRequestException} 用户不存在时抛出
   * @throws {BadRequestException} 已经点赞过该回复时抛出
   */
  async likeReply(createForumReplyLikeDto: CreateForumReplyLikeDto) {
    const { replyId, userId } = createForumReplyLikeDto

    const reply = await this.forumReply.findUnique({
      where: { id: replyId },
    })

    if (!reply) {
      throw new BadRequestException('回复不存在')
    }

    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const existingLike = await this.forumReplyLike.findUnique({
      where: {
        replyId_userId: {
          replyId,
          userId,
        },
      },
    })

    if (existingLike) {
      throw new BadRequestException('已经点赞过该回复')
    }

    const like = await this.prisma.$transaction(async (tx) => {
      const like = await tx.forumReplyLike.create({
        data: {
          replyId,
          userId,
        },
      })

      await tx.forumReply.update({
        where: { id: replyId },
        data: {
          likeCount: {
            increment: 1,
          },
        },
      })

      await this.actionLogService.createActionLog({
        userId,
        actionType: ForumUserActionTypeEnum.LIKE_REPLY,
        targetType: ForumUserActionTargetTypeEnum.REPLY,
        targetId: replyId,
      })

      return like
    })

    await this.userGrowthEventService.handleEvent({
      business: 'forum',
      eventKey: ForumGrowthEventKey.ReplyLike,
      userId,
      targetId: replyId,
      occurredAt: new Date(),
    })

    return like
  }

  /**
   * 取消点赞回复
   * @param deleteForumReplyLikeDto - 删除点赞记录的数据传输对象
   * @returns 被删除的点赞记录
   * @throws {BadRequestException} 点赞记录不存在时抛出
   * @throws {BadRequestException} 无权取消他人的点赞时抛出
   */
  async unlikeReply(deleteForumReplyLikeDto: DeleteForumReplyLikeDto) {
    const { id, userId } = deleteForumReplyLikeDto

    const like = await this.forumReplyLike.findUnique({
      where: { id },
    })

    if (!like) {
      throw new BadRequestException('点赞记录不存在')
    }

    if (like.userId !== userId) {
      throw new BadRequestException('无权取消他人的点赞')
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.forumReply.update({
        where: { id: like.replyId },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      })

      await this.actionLogService.createActionLog({
        userId,
        actionType: ForumUserActionTypeEnum.UNLIKE_REPLY,
        targetType: ForumUserActionTargetTypeEnum.REPLY,
        targetId: like.replyId,
      })

      return tx.forumReplyLike.delete({
        where: { id },
      })
    })
  }

  /**
   * 检查用户是否已点赞回复
   * @param replyId - 回复ID
   * @param userId - 用户ID
   * @returns 包含点赞状态的对象
   */
  async checkUserLiked(replyId: number, userId: number) {
    const like = await this.forumReplyLike.findUnique({
      where: {
        replyId_userId: {
          replyId,
          userId,
        },
      },
    })

    return {
      liked: !!like,
    }
  }
}
