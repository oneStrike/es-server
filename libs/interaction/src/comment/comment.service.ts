import { UserStatusEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { SensitiveWordLevelEnum } from '@libs/sensitive-word/sensitive-word-constant'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { SystemConfigService } from '@libs/system-config'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CounterService } from '../counter/counter.service'
import { AuditRole, AuditStatus, InteractionTargetType } from '../interaction.constant'
import { TargetValidatorRegistry } from '../validator/target-validator.registry'

@Injectable()
export class CommentService extends BaseService {
  constructor(
    private readonly counterService: CounterService,
    private readonly validatorRegistry: TargetValidatorRegistry,
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly systemConfigService: SystemConfigService,
  ) {
    super()
  }

  private isVisible(comment: {
    auditStatus: number
    isHidden: boolean
    deletedAt: Date | null
  }) {
    return (
      comment.auditStatus === AuditStatus.APPROVED
      && !comment.isHidden
      && comment.deletedAt === null
    )
  }

  private async resolveAuditDecision(content: string) {
    const result = this.sensitiveWordDetectService.getMatchedWords({ content })
    const config = await this.systemConfigService.findActiveConfig()
    const policy = config?.contentReviewPolicy
    let auditStatus: AuditStatus = AuditStatus.APPROVED
    let isHidden = false

    if (policy && result.highestLevel) {
      if (result.highestLevel === SensitiveWordLevelEnum.SEVERE) {
        auditStatus = policy.severeAction.auditStatus as AuditStatus
        isHidden = policy.severeAction.isHidden ?? false
      } else if (result.highestLevel === SensitiveWordLevelEnum.GENERAL) {
        auditStatus = policy.generalAction.auditStatus as AuditStatus
        isHidden = policy.generalAction.isHidden ?? false
      } else {
        auditStatus = policy.lightAction.auditStatus as AuditStatus
        isHidden = policy.lightAction.isHidden ?? false
      }
    }

    if (auditStatus === AuditStatus.PENDING) {
      return {
        auditStatus: AuditStatus.PENDING,
        isHidden,
        sensitiveWordHits: result.hits?.length ? result.hits : undefined,
      }
    }
    if (auditStatus === AuditStatus.REJECTED) {
      return {
        auditStatus: AuditStatus.REJECTED,
        isHidden,
        sensitiveWordHits: result.hits?.length ? result.hits : undefined,
      }
    }
    return {
      auditStatus: AuditStatus.APPROVED,
      isHidden,
      sensitiveWordHits: result.hits?.length ? result.hits : undefined,
    }
  }

  private async ensureUserCanComment(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: { isEnabled: true, status: true },
    })

    if (!user || !user.isEnabled) {
      throw new BadRequestException('用户不存在或已被禁用')
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BadRequestException('用户已被禁言或封禁，无法评论')
    }
  }

  private async ensureTargetCanComment(
    targetType: InteractionTargetType,
    targetId: number,
  ) {
    if (targetType === InteractionTargetType.COMIC || targetType === InteractionTargetType.NOVEL) {
      const work = await this.prisma.work.findUnique({
        where: { id: targetId },
        select: { canComment: true },
      })
      if (!work?.canComment) {
        throw new BadRequestException('目标不允许评论')
      }
      return
    }

    if (targetType === InteractionTargetType.COMIC_CHAPTER || targetType === InteractionTargetType.NOVEL_CHAPTER) {
      const chapter = await this.prisma.workChapter.findUnique({
        where: { id: targetId },
        select: { canComment: true },
      })
      if (!chapter?.canComment) {
        throw new BadRequestException('目标不允许评论')
      }
      return
    }

    if (targetType === InteractionTargetType.FORUM_TOPIC) {
      const topic = await this.prisma.forumTopic.findUnique({
        where: { id: targetId },
        select: { isLocked: true },
      })
      if (topic?.isLocked) {
        throw new BadRequestException('帖子已锁定，无法评论')
      }
    }
  }

  private async incrementVisibleCount(
    tx: any,
    targetType: InteractionTargetType,
    targetId: number,
  ) {
    await this.counterService.incrementCount(tx, targetType, targetId, 'commentCount')
  }

  private async decrementVisibleCount(
    tx: any,
    targetType: InteractionTargetType,
    targetId: number,
  ) {
    const current = await this.counterService.getCount(targetType, targetId, 'commentCount')
    if (current <= 0) {
      return
    }
    await this.counterService.decrementCount(tx, targetType, targetId, 'commentCount')
  }

  async createComment(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
    content: string,
    replyToId?: number,
  ): Promise<any> {
    const validator = this.validatorRegistry.getValidator(targetType)
    const result = await validator.validate(targetId)

    if (!result.valid) {
      throw new BadRequestException(result.message || '目标不存在')
    }

    await this.ensureUserCanComment(userId)
    await this.ensureTargetCanComment(targetType, targetId)

    const decision = await this.resolveAuditDecision(content)
    let floor: number | null = null
    let actualReplyToId: number | null = null

    if (!replyToId) {
      const lastComment = await this.prisma.userComment.findFirst({
        where: {
          targetType,
          targetId,
          replyToId: null,
        },
        orderBy: { floor: 'desc' },
        select: { floor: true },
      })
      floor = (lastComment?.floor ?? 0) + 1
    } else {
      const replyTo = await this.prisma.userComment.findUnique({
        where: { id: replyToId },
        select: {
          id: true,
          targetType: true,
          targetId: true,
          replyToId: true,
          actualReplyToId: true,
          deletedAt: true,
        },
      })
      if (!replyTo || replyTo.deletedAt) {
        throw new BadRequestException('回复目标不存在')
      }
      if (replyTo.targetType !== targetType || replyTo.targetId !== targetId) {
        throw new BadRequestException('回复目标与当前评论目标不一致')
      }
      actualReplyToId = replyTo.replyToId ? (replyTo.actualReplyToId ?? replyTo.id) : replyTo.id
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const newComment = await tx.userComment.create({
        data: {
          targetType,
          targetId,
          userId,
          content,
          floor,
          replyToId: replyToId || null,
          actualReplyToId,
          auditStatus: decision.auditStatus,
          isHidden: decision.isHidden,
          sensitiveWordHits: decision.sensitiveWordHits as any,
        },
      })

      if (this.isVisible({
        auditStatus: decision.auditStatus,
        isHidden: decision.isHidden,
        deletedAt: null,
      })) {
        await this.incrementVisibleCount(tx, targetType, targetId)
      }

      return newComment
    })

    return comment
  }

  async deleteComment(
    commentId: number,
    userId: number,
  ): Promise<void> {
    const comment = await this.prisma.userComment.findUnique({
      where: { id: commentId, deletedAt: null },
    })

    if (!comment || comment.userId !== userId) {
      throw new BadRequestException('评论不存在或无权限删除')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userComment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      })

      if (this.isVisible(comment)) {
        await this.decrementVisibleCount(
          tx,
          comment.targetType as InteractionTargetType,
          comment.targetId,
        )
      }
    })
  }

  async deleteCommentByAdmin(commentId: number): Promise<void> {
    const comment = await this.prisma.userComment.findUnique({
      where: { id: commentId, deletedAt: null },
    })
    if (!comment) {
      throw new NotFoundException('评论不存在')
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.userComment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      })
      if (this.isVisible(comment)) {
        await this.decrementVisibleCount(
          tx,
          comment.targetType as InteractionTargetType,
          comment.targetId,
        )
      }
    })
  }

  async getComments(
    targetType: InteractionTargetType,
    targetId: number,
    pageIndex: number = 1,
    pageSize: number = 20,
  ) {
    return this.prisma.userComment.findPagination({
      where: {
        targetType,
        targetId,
        replyToId: null,
        auditStatus: AuditStatus.APPROVED,
        isHidden: false,
        deletedAt: null,
        pageIndex,
        pageSize,
      } as any,
      orderBy: { floor: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            replies: {
              where: { deletedAt: null },
            },
          },
        },
      },
    })
  }

  async getReplies(
    commentId: number,
    pageIndex: number = 1,
    pageSize: number = 20,
  ) {
    return this.prisma.userComment.findPagination({
      where: {
        actualReplyToId: commentId,
        auditStatus: AuditStatus.APPROVED,
        isHidden: false,
        deletedAt: null,
        pageIndex,
        pageSize,
      } as any,
      orderBy: { createdAt: 'asc' },
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
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                nickname: true,
              },
            },
          },
        },
      },
    })
  }

  async getCommentManagePage(query: {
    targetType?: InteractionTargetType
    targetId?: number
    auditStatus?: AuditStatus
    isHidden?: boolean
    rootOnly?: boolean
    pageIndex?: number
    pageSize?: number
  }) {
    const {
      targetType,
      targetId,
      auditStatus,
      isHidden,
      rootOnly = false,
      pageIndex = 1,
      pageSize = 20,
    } = query
    return this.prisma.userComment.findPagination({
      where: {
        ...(targetType !== undefined && { targetType }),
        ...(targetId !== undefined && { targetId }),
        ...(auditStatus !== undefined && { auditStatus }),
        ...(isHidden !== undefined && { isHidden }),
        ...(rootOnly && { replyToId: null }),
        deletedAt: null,
        pageIndex,
        pageSize,
      } as any,
      orderBy: { createdAt: 'desc' },
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
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                nickname: true,
              },
            },
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
            id: true,
            userId: true,
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
      throw new NotFoundException('评论不存在')
    }
    return comment
  }

  async updateCommentAudit(
    body: {
      commentId: number
      auditStatus: AuditStatus
      auditReason?: string
    },
    operatorId: number,
  ) {
    const comment = await this.prisma.userComment.findUnique({
      where: { id: body.commentId, deletedAt: null },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        auditStatus: true,
        isHidden: true,
        deletedAt: true,
      },
    })
    if (!comment) {
      throw new NotFoundException('评论不存在')
    }
    const beforeVisible = this.isVisible(comment)
    const updated = await this.prisma.userComment.update({
      where: { id: body.commentId },
      data: {
        auditStatus: body.auditStatus,
        auditReason: body.auditReason,
        auditById: operatorId,
        auditRole: AuditRole.ADMIN,
        auditAt: new Date(),
      },
      select: {
        targetType: true,
        targetId: true,
        auditStatus: true,
        isHidden: true,
        deletedAt: true,
      },
    })
    const afterVisible = this.isVisible(updated)
    if (beforeVisible !== afterVisible) {
      await this.prisma.$transaction(async (tx) => {
        if (afterVisible) {
          await this.incrementVisibleCount(
            tx,
            updated.targetType as InteractionTargetType,
            updated.targetId,
          )
        } else {
          await this.decrementVisibleCount(
            tx,
            updated.targetType as InteractionTargetType,
            updated.targetId,
          )
        }
      })
    }
    return { success: true }
  }

  async updateCommentHidden(body: { commentId: number, isHidden: boolean }) {
    const comment = await this.prisma.userComment.findUnique({
      where: { id: body.commentId, deletedAt: null },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        auditStatus: true,
        isHidden: true,
        deletedAt: true,
      },
    })
    if (!comment) {
      throw new NotFoundException('评论不存在')
    }
    const beforeVisible = this.isVisible(comment)
    const updated = await this.prisma.userComment.update({
      where: { id: body.commentId },
      data: { isHidden: body.isHidden },
      select: {
        targetType: true,
        targetId: true,
        auditStatus: true,
        isHidden: true,
        deletedAt: true,
      },
    })
    const afterVisible = this.isVisible(updated)
    if (beforeVisible !== afterVisible) {
      await this.prisma.$transaction(async (tx) => {
        if (afterVisible) {
          await this.incrementVisibleCount(
            tx,
            updated.targetType as InteractionTargetType,
            updated.targetId,
          )
        } else {
          await this.decrementVisibleCount(
            tx,
            updated.targetType as InteractionTargetType,
            updated.targetId,
          )
        }
      })
    }
    return { success: true }
  }

  async recalcCommentCount(targetType: InteractionTargetType, targetId: number) {
    const count = await this.prisma.userComment.count({
      where: {
        targetType,
        targetId,
        auditStatus: AuditStatus.APPROVED,
        isHidden: false,
        deletedAt: null,
      },
    })
    await this.counterService.setCount(targetType, targetId, 'commentCount', count)
    return { targetType, targetId, commentCount: count }
  }
}
