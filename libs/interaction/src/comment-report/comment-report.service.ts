import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
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
      throw new NotFoundException('评论不存在')
    }

    const existing = await this.prisma.userCommentReport.findFirst({
      where: {
        commentId,
        reporterId,
        status: ReportStatus.PENDING,
      },
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
    if (report.status !== ReportStatus.PENDING && report.status !== ReportStatus.PROCESSING) {
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
