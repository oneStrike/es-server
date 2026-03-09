import { AuditStatusEnum, InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import { SensitiveWordLevelEnum } from '@libs/sensitive-word/sensitive-word-constant'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { ConfigReader } from '@libs/system-config'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { CommentGrowthService } from './comment-growth.service'
import { CommentPermissionService } from './comment-permission.service'
import {
  CreateCommentDto,
  QueryCommentPageDto,
  QueryCommentRepliesDto,
  QueryMyCommentPageDto,
  ReplyCommentDto,
  UpdateCommentAuditDto,
  UpdateCommentHiddenDto,
} from './dto/comment.dto'

interface VisibleCommentPayload {
  id: number
  userId: number
  targetType: number
  targetId: number
  replyToId: number | null
  createdAt: Date
}

@Injectable()
export class CommentService extends BaseService {
  constructor(
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly configReader: ConfigReader,
    private readonly commentPermissionService: CommentPermissionService,
    private readonly commentGrowthService: CommentGrowthService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {
    super()
  }

  private isVisible(comment: {
    auditStatus: number
    isHidden: boolean
    deletedAt: Date | null
  }): boolean {
    return (
      comment.auditStatus === AuditStatusEnum.APPROVED &&
      !comment.isHidden &&
      comment.deletedAt === null
    )
  }

  private getTargetInfo(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
        return {
          model: tx.work,
          where: { id: targetId, type: 1, deletedAt: null },
        }
      case InteractionTargetTypeEnum.NOVEL:
        return {
          model: tx.work,
          where: { id: targetId, type: 2, deletedAt: null },
        }
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
        return {
          model: tx.workChapter,
          where: { id: targetId, workType: 1, deletedAt: null },
        }
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return {
          model: tx.workChapter,
          where: { id: targetId, workType: 2, deletedAt: null },
        }
      case InteractionTargetTypeEnum.FORUM_TOPIC:
        return {
          model: tx.forumTopic,
          where: { id: targetId, deletedAt: null },
        }
      case InteractionTargetTypeEnum.COMMENT:
      default:
        throw new BadRequestException('不支持的评论目标类型')
    }
  }

  private async applyCommentCountDelta(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const { model, where } = this.getTargetInfo(tx, targetType, targetId)
    await model.applyCountDelta(where, 'commentCount', delta)
  }

  private resolveAuditDecision(content: string) {
    const result = this.sensitiveWordDetectService.getMatchedWords({ content })
    const policy = this.configReader.getContentReviewPolicy()
    let auditStatus: AuditStatusEnum = AuditStatusEnum.APPROVED
    let isHidden = false

    if (result.highestLevel) {
      if (result.highestLevel === SensitiveWordLevelEnum.SEVERE) {
        auditStatus = policy.severeAction.auditStatus as AuditStatusEnum
        isHidden = policy.severeAction.isHidden
      } else if (result.highestLevel === SensitiveWordLevelEnum.GENERAL) {
        auditStatus = policy.generalAction.auditStatus as AuditStatusEnum
        isHidden = policy.generalAction.isHidden
      } else {
        auditStatus = policy.lightAction.auditStatus as AuditStatusEnum
        isHidden = policy.lightAction.isHidden
      }
    }

    return {
      auditStatus,
      isHidden,
      sensitiveWordHits:
        policy.recordHits && result.hits?.length
          ? (result.hits as any)
          : undefined,
    }
  }

  private async compensateVisibleCommentEffects(
    tx: any,
    comment: VisibleCommentPayload,
  ) {
    await this.commentGrowthService.rewardCommentCreated(tx, {
      userId: comment.userId,
      commentId: comment.id,
      targetType: comment.targetType,
      targetId: comment.targetId,
      occurredAt: comment.createdAt,
    })

    if (!comment.replyToId) {
      return
    }

    const replyTarget = await tx.userComment.findUnique({
      where: { id: comment.replyToId, deletedAt: null },
      select: {
        userId: true,
      },
    })

    if (!replyTarget || replyTarget.userId === comment.userId) {
      return
    }

    await this.messageOutboxService.enqueueNotificationEvent(
      {
        eventType: MessageNotificationTypeEnum.COMMENT_REPLY,
        bizKey: `comment:reply:${comment.id}:to:${replyTarget.userId}`,
        payload: {
          receiverUserId: replyTarget.userId,
          actorUserId: comment.userId,
          type: MessageNotificationTypeEnum.COMMENT_REPLY,
          targetType: comment.targetType,
          targetId: comment.targetId,
          subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
          subjectId: comment.id,
          title: '收到新的评论回复',
          content: '你收到了一条新的评论回复',
        },
      },
      tx,
    )
  }

  async createComment(dto: CreateCommentDto) {
    const { userId, targetType, targetId, content } = dto
    await this.commentPermissionService.ensureCanComment(
      userId,
      targetType,
      targetId,
    )

    const decision = this.resolveAuditDecision(content)

    try {
      return await this.withTransactionConflictRetry(
        async () =>
          this.prisma.$transaction(
            async (tx) => {
              const result = await tx.userComment.aggregate({
                where: {
                  targetType,
                  targetId,
                  replyToId: null,
                },
                _max: { floor: true },
              })
              const floor = (result._max.floor ?? 0) + 1

              const newComment = await tx.userComment.create({
                data: {
                  targetType,
                  targetId,
                  userId,
                  content,
                  floor,
                  ...decision,
                },
                select: {
                  id: true,
                  userId: true,
                  targetType: true,
                  targetId: true,
                  replyToId: true,
                  createdAt: true,
                },
              })

              if (this.isVisible({ ...decision, deletedAt: null })) {
                await this.applyCommentCountDelta(tx, targetType, targetId, 1)
                await this.compensateVisibleCommentEffects(tx, newComment)
              }

              return { id: newComment.id }
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          ),
        {
          maxRetries: 3,
        },
      )
    } catch (error) {
      this.handlePrismaBusinessError(error, {
        conflictMessage: '请求冲突，请稍后重试',
      })
    }
  }

  async replyComment(dto: ReplyCommentDto) {
    const { userId, content, replyToId } = dto

    const replyTo = await this.prisma.userComment.findUnique({
      where: { id: replyToId },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        userId: true,
        replyToId: true,
        actualReplyToId: true,
        deletedAt: true,
      },
    })
    if (!replyTo || replyTo.deletedAt) {
      throw new BadRequestException('回复目标不存在')
    }

    const { targetType, targetId } = replyTo
    await this.commentPermissionService.ensureCanComment(
      userId,
      targetType as InteractionTargetTypeEnum,
      targetId,
    )

    const actualReplyToId = replyTo.replyToId
      ? (replyTo.actualReplyToId ?? replyTo.id)
      : replyTo.id

    const decision = this.resolveAuditDecision(content)

    return this.prisma.$transaction(async (tx) => {
      const newComment = await tx.userComment.create({
        data: {
          targetType,
          targetId,
          userId,
          content,
          replyToId,
          actualReplyToId,
          ...decision,
        },
        select: {
          id: true,
          userId: true,
          targetType: true,
          targetId: true,
          replyToId: true,
          createdAt: true,
        },
      })

      if (this.isVisible({ ...decision, deletedAt: null })) {
        await this.applyCommentCountDelta(
          tx,
          targetType as InteractionTargetTypeEnum,
          targetId,
          1,
        )
        await this.compensateVisibleCommentEffects(tx, newComment)
      }

      return { id: newComment.id }
    })
  }

  async deleteComment(commentId: number, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const where = userId ? { id: commentId, userId } : { id: commentId }
      const result = await tx.userComment.softDelete(where)

      if (!this.isVisible({ ...result, deletedAt: null })) {
        return { id: result.id }
      }

      await this.applyCommentCountDelta(
        tx,
        result.targetType as InteractionTargetTypeEnum,
        result.targetId,
        -1,
      )
      return { id: result.id }
    })
  }

  async getReplies(dto: QueryCommentRepliesDto) {
    const { commentId, ...otherDto } = dto
    return this.prisma.userComment.findPagination({
      where: {
        actualReplyToId: commentId,
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: null,
        ...otherDto,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    })
  }

  async getCommentManagePage(query: QueryCommentPageDto) {
    const { rootOnly = false, ...otherDto } = query

    return this.prisma.userComment.findPagination({
      where: {
        ...(rootOnly && { replyToId: null }),
        deletedAt: null,
        ...otherDto,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    })
  }

  async getCommentDetail(commentId: number) {
    const comment = await this.prisma.userComment.findUnique({
      where: { id: commentId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
        replyTo: {
          select: {
            user: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
      },
    })

    if (!comment) {
      throw new NotFoundException('未找到相关评论')
    }

    return comment
  }

  async updateCommentAudit(dto: UpdateCommentAuditDto) {
    await this.prisma.$transaction(async (tx) => {
      const comment = await tx.userComment.findUnique({
        where: { id: dto.commentId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          targetType: true,
          targetId: true,
          replyToId: true,
          createdAt: true,
          auditStatus: true,
          isHidden: true,
          deletedAt: true,
        },
      })
      if (!comment) {
        throw new NotFoundException('未找到相关评论')
      }

      const beforeVisible = this.isVisible(comment)

      const { commentId, ...otherDto } = dto
      const updated = await tx.userComment.update({
        where: { id: commentId, deletedAt: null },
        data: {
          ...otherDto,
          auditAt: new Date(),
        },
        select: {
          id: true,
          userId: true,
          targetType: true,
          targetId: true,
          replyToId: true,
          createdAt: true,
          auditStatus: true,
          isHidden: true,
          deletedAt: true,
        },
      })

      const afterVisible = this.isVisible(updated)
      if (beforeVisible !== afterVisible) {
        await this.applyCommentCountDelta(
          tx,
          updated.targetType as InteractionTargetTypeEnum,
          updated.targetId,
          afterVisible ? 1 : -1,
        )
      }

      if (!beforeVisible && afterVisible) {
        await this.compensateVisibleCommentEffects(tx, updated)
      }
    })

    return { id: dto.commentId }
  }

  async updateCommentHidden(dto: UpdateCommentHiddenDto) {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.userComment.findUnique({
        where: { id: dto.commentId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          targetType: true,
          targetId: true,
          replyToId: true,
          createdAt: true,
          isHidden: true,
          auditStatus: true,
          deletedAt: true,
        },
      })

      if (!before) {
        throw new NotFoundException('未找到相关评论')
      }

      if (before.isHidden === dto.isHidden) {
        return
      }

      const updated = await tx.userComment.update({
        where: { id: dto.commentId, deletedAt: null },
        data: { isHidden: dto.isHidden },
        select: {
          id: true,
          userId: true,
          targetType: true,
          targetId: true,
          replyToId: true,
          createdAt: true,
          isHidden: true,
          auditStatus: true,
          deletedAt: true,
        },
      })

      const beforeVisible = this.isVisible(before)
      const afterVisible = this.isVisible(updated)

      if (beforeVisible !== afterVisible) {
        await this.applyCommentCountDelta(
          tx,
          updated.targetType as InteractionTargetTypeEnum,
          updated.targetId,
          afterVisible ? 1 : -1,
        )
      }

      if (!beforeVisible && afterVisible) {
        await this.compensateVisibleCommentEffects(tx, updated)
      }
    })

    return { id: dto.commentId }
  }

  async getUserComments(dto: QueryMyCommentPageDto, userId: number) {
    return this.prisma.userComment.findPagination({
      where: {
        userId,
        deletedAt: null,
        ...dto,
      },
    })
  }
}
