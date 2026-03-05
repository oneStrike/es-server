import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ReportStatus } from '../common.constant'

@Injectable()
export class CommentInteractionService extends BaseService {
  private isDuplicateError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    )
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    )
  }

  private async ensureCommentExists(commentId: number) {
    const comment = await this.prisma.userComment.findUnique({
      where: { id: commentId, deletedAt: null },
      select: { id: true },
    })

    if (!comment) {
      throw new NotFoundException('评论不存在')
    }
  }

  async likeComment(commentId: number, userId: number): Promise<void> {
    await this.ensureCommentExists(commentId)

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.userCommentLike.create({
          data: { commentId, userId },
        })
      } catch (error) {
        if (this.isDuplicateError(error)) {
          throw new BadRequestException('已经点赞过该评论')
        }
        throw error
      }

      await tx.userComment.update({
        where: { id: commentId },
        data: {
          likeCount: {
            increment: 1,
          },
        },
      })
    })
  }

  async unlikeComment(commentId: number, userId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
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

      await tx.userComment.updateMany({
        where: {
          id: commentId,
          likeCount: { gte: 1 },
        },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      })
    })
  }

  async checkLikeStatus(commentId: number, userId: number): Promise<boolean> {
    const like = await this.prisma.userCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
      select: { id: true },
    })
    return !!like
  }

  async checkLikeStatusBatch(
    commentIds: number[],
    userId: number,
  ): Promise<Map<number, boolean>> {
    if (commentIds.length === 0) {
      return new Map()
    }

    const likes = await this.prisma.userCommentLike.findMany({
      where: {
        commentId: { in: commentIds },
        userId,
      },
      select: {
        commentId: true,
      },
    })

    const likedSet = new Set(likes.map((l) => l.commentId))
    const statusMap = new Map<number, boolean>()

    for (const commentId of commentIds) {
      statusMap.set(commentId, likedSet.has(commentId))
    }

    return statusMap
  }

  async reportComment(
    commentId: number,
    reporterId: number,
    reason: string,
    description?: string,
    evidenceUrl?: string,
  ): Promise<void> {
    await this.ensureCommentExists(commentId)

    const existing = await this.prisma.userCommentReport.findFirst({
      where: {
        commentId,
        reporterId,
        status: ReportStatus.PENDING,
      },
      select: { id: true },
    })

    if (existing) {
      throw new BadRequestException('已经举报过该评论，请等待处理')
    }

    await this.prisma.userCommentReport.create({
      data: {
        commentId,
        reporterId,
        reason,
        description,
        evidenceUrl,
        status: ReportStatus.PENDING,
      },
    })
  }

  async getReports(
    status?: ReportStatus,
    pageIndex: number = 1,
    pageSize: number = 20,
  ) {
    return this.prisma.userCommentReport.findPagination({
      where: {
        ...(status !== undefined && { status }),
        pageIndex,
        pageSize,
      } as any,
      orderBy: { createdAt: 'desc' },
      include: {
        comment: {
          select: {
            id: true,
            content: true,
            userId: true,
          },
        },
        reporter: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
    })
  }

  async handleReport(
    reportId: number,
    handlerId: number,
    status: ReportStatus.RESOLVED | ReportStatus.REJECTED,
    handlingNote?: string,
  ): Promise<void> {
    const report = await this.prisma.userCommentReport.findUnique({
      where: { id: reportId },
      select: { id: true, status: true },
    })
    if (!report) {
      throw new NotFoundException('举报记录不存在')
    }
    if (
      report.status !== ReportStatus.PENDING &&
      report.status !== ReportStatus.PROCESSING
    ) {
      throw new BadRequestException('举报已处理，请勿重复处理')
    }
    await this.prisma.userCommentReport.update({
      where: { id: reportId },
      data: {
        handlerId,
        status,
        handlingNote,
        handledAt: new Date(),
      },
    })
  }
}
