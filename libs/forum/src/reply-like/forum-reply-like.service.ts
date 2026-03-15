import { GrowthRuleTypeEnum, UserGrowthRewardService } from '@libs/growth'
import {
  CommentLevelEnum,
  InteractionTargetTypeEnum,
  SceneTypeEnum,
} from '@libs/platform/constant'
import { PlatformService } from '@libs/platform/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import {
  CreateForumReplyLikeDto,
  DeleteForumReplyLikeDto,
} from './dto/forum-reply-like.dto'

/**
 * 论坛回复点赞服务
 * 提供回复点赞、取消点赞等功能
 */
@Injectable()
export class ForumReplyLikeService extends PlatformService {
  constructor(
    /** 操作日志服务 */
    private readonly actionLogService: ForumUserActionLogService,
    /** 用户成长奖励服务 */
    private readonly userGrowthRewardService: UserGrowthRewardService,
  ) {
    super()
  }

  /** 回复点赞表 */
  get forumReplyLike() {
    return this.prisma.userLike
  }

  /** 回复表 */
  get forumReply() {
    return this.prisma.userComment
  }

  /**
   * 点赞回复
   *
   * @param createForumReplyLikeDto - 点赞数据
   * @returns 创建的点赞记录
   * @throws BadRequestException 回复不存在或已点赞
   */
  async likeReply(createForumReplyLikeDto: CreateForumReplyLikeDto) {
    const { replyId, userId } = createForumReplyLikeDto

    const reply = await this.forumReply.findFirst({
      where: { id: replyId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        targetId: true,
        replyToId: true,
      },
    })

    if (!reply) {
      throw new BadRequestException('回复不存在')
    }

    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const existingLike = await this.forumReplyLike.findUnique({
      where: {
        targetType_targetId_userId: {
          targetType: InteractionTargetTypeEnum.COMMENT,
          targetId: replyId,
          userId,
        },
      },
    })

    if (existingLike) {
      throw new BadRequestException('已经点赞过该回复')
    }

    const like = await this.prisma.$transaction(async (tx) => {
      const createdLike = await tx.userLike.create({
        data: {
          targetType: InteractionTargetTypeEnum.COMMENT,
          targetId: replyId,
          sceneType: SceneTypeEnum.FORUM_TOPIC,
          sceneId: reply.targetId,
          commentLevel: reply.replyToId
            ? CommentLevelEnum.REPLY
            : CommentLevelEnum.ROOT,
          userId,
        },
      })

      await tx.userComment.update({
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

      return createdLike
    })

    await this.userGrowthRewardService.tryRewardByRule({
      userId,
      ruleType: GrowthRuleTypeEnum.REPLY_LIKED,
      bizKey: `forum:reply:like:${replyId}:user:${userId}`,
      source: 'forum_reply_like',
      remark: `like forum reply #${replyId}`,
      targetId: replyId,
    })

    return like
  }

  /**
   * 取消点赞回复
   *
   * @param deleteForumReplyLikeDto - 取消点赞数据
   * @returns 删除的点赞记录
   * @throws BadRequestException 点赞记录不存在或无权操作
   */
  async unlikeReply(deleteForumReplyLikeDto: DeleteForumReplyLikeDto) {
    const { id, userId } = deleteForumReplyLikeDto

    const like = await this.forumReplyLike.findFirst({
      where: {
        id,
        targetType: InteractionTargetTypeEnum.COMMENT,
      },
    })

    if (!like) {
      throw new BadRequestException('点赞记录不存在')
    }

    if (like.userId !== userId) {
      throw new BadRequestException('无权取消他人的点赞')
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.userComment.update({
        where: { id: like.targetId },
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
        targetId: like.targetId,
      })

      return tx.userLike.delete({
        where: { id },
      })
    })
  }

  /**
   * 检查用户是否已点赞
   *
   * @param replyId - 回复ID
   * @param userId - 用户ID
   * @returns 是否已点赞
   */
  async checkUserLiked(replyId: number, userId: number) {
    const like = await this.forumReplyLike.findUnique({
      where: {
        targetType_targetId_userId: {
          targetType: InteractionTargetTypeEnum.COMMENT,
          targetId: replyId,
          userId,
        },
      },
    })

    return {
      liked: !!like,
    }
  }
}
