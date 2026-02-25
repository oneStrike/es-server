import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { ReportStatus } from '../interaction.constant'

@Injectable()
export class CommentReportService extends BaseService {
  async reportComment(
    commentId: number,
    reporterId: number,
    reason: string,
    description?: string,
    evidenceUrl?: string,
  ): Promise<void> {
    const comment = await this.prisma.userComment.findUnique({
      where: { id: commentId },
    })

    if (!comment) {
      throw new Error('评论不存在')
    }

    const existing = await this.prisma.userCommentReport.findFirst({
      where: {
        commentId,
        reporterId,
        status: ReportStatus.PENDING,
      },
    })

    if (existing) {
      throw new Error('已经举报过该评论，请等待处理')
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
