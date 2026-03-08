import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { UserGrowthRewardService } from '@libs/user/growth-reward'
import { GrowthRuleTypeEnum } from '@libs/user/growth-rule.constant'
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

@Injectable()
export class ForumReplyLikeService extends BaseService {
  constructor(
    private readonly actionLogService: ForumUserActionLogService,
    private readonly userGrowthRewardService: UserGrowthRewardService,
  ) {
    super()
  }

  get forumReplyLike() {
    return this.prisma.userLike
  }

  get forumReply() {
    return this.prisma.userComment
  }

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
