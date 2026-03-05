import { BaseService } from '@libs/base/database'
import { SensitiveWordLevelEnum } from '@libs/sensitive-word/sensitive-word-constant'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { SystemConfigService } from '@libs/system-config'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  AuditRole,
  AuditStatus,
  InteractionTargetType,
} from '../common.constant'
import { CommentCountService } from './comment-count.service'
import { CommentPermissionService } from './comment-permission.service'

@Injectable()
export class CommentService extends BaseService {
  constructor(
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly systemConfigService: SystemConfigService,
    private readonly commentPermissionService: CommentPermissionService,
    private readonly commentCountService: CommentCountService,
  ) {
    super()
  }

  /**
   * �������дʺ�ϵͳ���þ�����˽����
   */
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

    return {
      auditStatus,
      isHidden,
      sensitiveWordHits: result.hits?.length ? result.hits : undefined,
    }
  }

  private isRecordNotFound(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    )
  }

  async createComment(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
    content: string,
    replyToId?: number,
  ) {
    await Promise.all([
      this.commentPermissionService.ensureTargetCanComment(targetType, targetId),
      this.commentPermissionService.ensureUserCanComment(userId),
    ])

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
        throw new BadRequestException('Reply target not found')
      }
      if (replyTo.targetType !== targetType || replyTo.targetId !== targetId) {
        throw new BadRequestException(
          'Reply target does not match current target',
        )
      }
      actualReplyToId = replyTo.replyToId
        ? (replyTo.actualReplyToId ?? replyTo.id)
        : replyTo.id
    }

    return this.prisma.$transaction(async (tx) => {
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

      if (
        this.commentCountService.isVisible({
          auditStatus: decision.auditStatus,
          isHidden: decision.isHidden,
          deletedAt: null,
        })
      ) {
        await this.commentCountService.applyCommentCountDelta(
          tx,
          targetType,
          targetId,
          1,
        )
      }

      return newComment
    })
  }

  async deleteComment(commentId: number, userId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date()
      let updatedComment: {
        targetType: number
        targetId: number
        auditStatus: number
        isHidden: boolean
      }

      try {
        updatedComment = await tx.userComment.update({
          where: { id: commentId, userId, deletedAt: null },
          data: { deletedAt: now },
          select: {
            targetType: true,
            targetId: true,
            auditStatus: true,
            isHidden: true,
          },
        })
      } catch (error) {
        if (this.isRecordNotFound(error)) {
          throw new BadRequestException(
            'Comment not found or no permission to delete',
          )
        }
        throw error
      }

      const beforeVisible = this.commentCountService.isVisible({
        auditStatus: updatedComment.auditStatus,
        isHidden: updatedComment.isHidden,
        deletedAt: null,
      })

      if (!beforeVisible) {
        return
      }

      await this.commentCountService.applyCommentCountDelta(
        tx,
        updatedComment.targetType as InteractionTargetType,
        updatedComment.targetId,
        -1,
      )
    })
  }

  async deleteCommentByAdmin(commentId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date()
      let updatedComment: {
        targetType: number
        targetId: number
        auditStatus: number
        isHidden: boolean
      }

      try {
        updatedComment = await tx.userComment.update({
          where: { id: commentId, deletedAt: null },
          data: { deletedAt: now },
          select: {
            targetType: true,
            targetId: true,
            auditStatus: true,
            isHidden: true,
          },
        })
      } catch (error) {
        if (this.isRecordNotFound(error)) {
          throw new NotFoundException('Comment not found')
        }
        throw error
      }

      const beforeVisible = this.commentCountService.isVisible({
        auditStatus: updatedComment.auditStatus,
        isHidden: updatedComment.isHidden,
        deletedAt: null,
      })

      if (!beforeVisible) {
        return
      }

      await this.commentCountService.applyCommentCountDelta(
        tx,
        updatedComment.targetType as InteractionTargetType,
        updatedComment.targetId,
        -1,
      )
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
      throw new NotFoundException('Comment not found')
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
    await this.prisma.$transaction(async (tx) => {
      const comment = await tx.userComment.findUnique({
        where: { id: body.commentId, deletedAt: null },
        select: {
          targetType: true,
          targetId: true,
          auditStatus: true,
          isHidden: true,
          deletedAt: true,
        },
      })
      if (!comment) {
        throw new NotFoundException('Comment not found')
      }

      const beforeVisible = this.commentCountService.isVisible(comment)

      let updated: {
        targetType: number
        targetId: number
        auditStatus: number
        isHidden: boolean
        deletedAt: Date | null
      }

      try {
        updated = await tx.userComment.update({
          where: { id: body.commentId, deletedAt: null },
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
      } catch (error) {
        if (this.isRecordNotFound(error)) {
          throw new NotFoundException('Comment not found')
        }
        throw error
      }

      const afterVisible = this.commentCountService.isVisible(updated)
      await this.commentCountService.syncVisibleCountByTransition(
        tx,
        updated.targetType as InteractionTargetType,
        updated.targetId,
        beforeVisible,
        afterVisible,
      )
    })

    return { success: true }
  }

  async updateCommentHidden(body: { commentId: number, isHidden: boolean }) {
    await this.prisma.$transaction(async (tx) => {
      const comment = await tx.userComment.findUnique({
        where: { id: body.commentId, deletedAt: null },
        select: {
          targetType: true,
          targetId: true,
          auditStatus: true,
          isHidden: true,
          deletedAt: true,
        },
      })
      if (!comment) {
        throw new NotFoundException('Comment not found')
      }

      const beforeVisible = this.commentCountService.isVisible(comment)
      let updated: {
        targetType: number
        targetId: number
        auditStatus: number
        isHidden: boolean
        deletedAt: Date | null
      }

      try {
        updated = await tx.userComment.update({
          where: { id: body.commentId, deletedAt: null },
          data: { isHidden: body.isHidden },
          select: {
            targetType: true,
            targetId: true,
            auditStatus: true,
            isHidden: true,
            deletedAt: true,
          },
        })
      } catch (error) {
        if (this.isRecordNotFound(error)) {
          throw new NotFoundException('Comment not found')
        }
        throw error
      }

      const afterVisible = this.commentCountService.isVisible(updated)
      await this.commentCountService.syncVisibleCountByTransition(
        tx,
        updated.targetType as InteractionTargetType,
        updated.targetId,
        beforeVisible,
        afterVisible,
      )
    })

    return { success: true }
  }

  async recalcCommentCount(
    targetType: InteractionTargetType,
    targetId: number,
  ) {
    const count = await this.prisma.userComment.count({
      where: {
        targetType,
        targetId,
        auditStatus: AuditStatus.APPROVED,
        isHidden: false,
        deletedAt: null,
      },
    })

    await this.commentCountService.setCommentCount(targetType, targetId, count)
    return { targetType, targetId, commentCount: count }
  }
}
