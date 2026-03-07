import {
  ReportTargetTypeEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ReportStatusEnum } from '../common.constant'
import { CommentGrowthService } from './comment-growth.service'
import { ReportCommentDto } from './dto/comment-interaction.dto'

/**
 * 评论交互服务
 * 处理评论的点赞、取消点赞、举报等交互操作
 */
@Injectable()
export class CommentInteractionService extends BaseService {
  constructor(
    private readonly commentGrowthService: CommentGrowthService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {
    super()
  }

  /**
   * 点赞评论
   * @param commentId - 评论ID
   * @param userId - 用户ID
   * @throws BadRequestException 已点赞过该评论时抛出
   * @throws NotFoundException 评论不存在时抛出
   */
  async likeComment(commentId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.userComment.findUnique({
        where: { id: commentId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          targetType: true,
          targetId: true,
          likes: {
            where: { userId },
            select: {
              id: true,
            },
          },
        },
      })

      if (!comment) {
        throw new NotFoundException('评论不存在')
      }
      if (comment.likes.length) {
        throw new BadRequestException('已点赞过该评论')
      }

      await tx.userCommentLike.create({
        data: { commentId, userId },
      })

      await tx.userComment.applyCountDelta({ id: commentId }, 'likeCount', 1)

      // 点赞奖励发给评论作者（非点赞人）
      await this.commentGrowthService.rewardCommentLiked(tx, {
        commentId,
        authorUserId: comment.userId,
        likerUserId: userId,
      })

      if (comment.userId !== userId) {
        await this.messageOutboxService.enqueueNotificationEvent(
          {
            eventType: MessageNotificationTypeEnum.COMMENT_LIKE,
            bizKey: `notify:comment:like:${commentId}:actor:${userId}:receiver:${comment.userId}`,
            payload: {
              receiverUserId: comment.userId,
              actorUserId: userId,
              type: MessageNotificationTypeEnum.COMMENT_LIKE,
              targetType: comment.targetType,
              targetId: comment.targetId,
              subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
              subjectId: comment.id,
              title: '你的评论收到了点赞',
              content: '有人点赞了你的评论',
            },
          },
          tx,
        )
      }
      return { id: commentId }
    })
  }

  /**
   * 取消点赞评论
   * @param commentId - 评论ID
   * @param userId - 用户ID
   * @throws BadRequestException 尚未点赞该评论时抛出
   */
  async unlikeComment(commentId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.userComment.findUnique({
        where: { id: commentId, deletedAt: null },
        select: {
          id: true,
          likes: {
            select: {
              id: true,
            },
          },
        },
      })

      if (!comment) {
        throw new NotFoundException('评论不存在')
      }

      if (!comment.likes.length) {
        throw new BadRequestException('尚未点赞该评论')
      }
      await tx.userCommentLike.delete({
        where: {
          commentId_userId: {
            commentId,
            userId,
          },
        },
      })

      await tx.userComment.applyCountDelta({ id: commentId }, 'likeCount', -1)
      return { id: commentId }
    })
  }

  /**
   * 举报评论
   * @param dto - 举报信息DTO
   * @throws NotFoundException 评论不存在时抛出
   * @throws BadRequestException 已举报过该评论时抛出
   */
  async reportComment(dto: ReportCommentDto) {
    const { commentId, reporterId, reason, description, evidenceUrl } = dto
    const [comment, existing] = await Promise.all([
      this.prisma.userComment.findUnique({
        where: { id: commentId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.userReport.findFirst({
        where: {
          targetId: commentId,
          reporterId,
        },
        select: { id: true },
      }),
    ])

    if (!comment) {
      throw new NotFoundException('评论不存在')
    }

    if (existing) {
      throw new BadRequestException('已经举报过该评论，请等待处理')
    }

    await this.prisma.userReport.create({
      data: {
        targetId: commentId,
        targetType: ReportTargetTypeEnum.COMMENT,
        reporterId,
        reason,
        description,
        evidenceUrl,
        status: ReportStatusEnum.PENDING,
      },
    })
  }
}
