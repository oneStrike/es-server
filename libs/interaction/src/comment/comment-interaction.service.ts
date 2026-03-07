import { ReportTargetTypeEnum } from '@libs/base/constant'
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
import { ReportService } from '../report/report.service'
import { CommentGrowthService } from './comment-growth.service'
import { ReportCommentDto } from './dto/comment-interaction.dto'

@Injectable()
export class CommentInteractionService extends BaseService {
  constructor(
    private readonly commentGrowthService: CommentGrowthService,
    private readonly messageOutboxService: MessageOutboxService,
    private readonly reportService: ReportService,
  ) {
    super()
  }

  private isDuplicateError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    )
  }

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

      try {
        await tx.userCommentLike.create({
          data: { commentId, userId },
        })
      } catch (error) {
        if (this.isDuplicateError(error)) {
          throw new BadRequestException('已点赞过该评论')
        }
        throw error
      }

      await tx.userComment.applyCountDelta({ id: commentId }, 'likeCount', 1)

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

  async unlikeComment(commentId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.userComment.findUnique({
        where: { id: commentId, deletedAt: null },
        select: {
          id: true,
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

      if (!comment.likes.length) {
        throw new BadRequestException('尚未点赞该评论')
      }

      try {
        await tx.userCommentLike.delete({
          where: {
            commentId_userId: {
              commentId,
              userId,
            },
          },
        })
      } catch (error) {
        if (this.isRecordNotFound(error)) {
          throw new BadRequestException('尚未点赞该评论')
        }
        throw error
      }

      await tx.userComment.applyCountDelta({ id: commentId }, 'likeCount', -1)
      return { id: commentId }
    })
  }

  async reportComment(dto: ReportCommentDto) {
    const { commentId, reporterId, reason, description, evidenceUrl } = dto

    const comment = await this.prisma.userComment.findUnique({
      where: { id: commentId, deletedAt: null },
      select: { id: true },
    })

    if (!comment) {
      throw new NotFoundException('评论不存在')
    }

    const report = await this.reportService.createReport(
      {
        targetId: commentId,
        targetType: ReportTargetTypeEnum.COMMENT,
        reporterId,
        reason,
        description,
        evidenceUrl,
      },
      {
        duplicateMessage: '已经举报过该评论，请等待处理',
      },
    )

    return { id: report.id }
  }
}
