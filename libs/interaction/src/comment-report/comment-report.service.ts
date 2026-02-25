import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { ReportStatus } from '../interaction.constant'

@Injectable()
export class CommentReportService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 举报评论
   */
  async reportComment(
    commentId: number,
    reporterId: number,
    reason: string,
    description?: string,
    evidenceUrl?: string,
  ): Promise<void> {
    // 检查评论是否存在
    const comment = await this.prisma.userComment.findUnique({
      where: { id: commentId },
    })

    if (!comment) {
      throw new Error('评论不存在')
    }

    // 检查是否已举报
    const existing = await this.prisma.userCommentReport.findFirst({
      where: {
        commentId,
        reporterId,
        status: { in: [ReportStatus.PENDING, ReportStatus.PROCESSING] },
      },
    })

    if (existing) {
      throw new Error('您已举报过该评论，请等待处理结果')
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

  /**
   * 获取举报列表（管理员）
   */
  async getReports(
    status?: ReportStatus,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ list: any[]; total: number }> {
    const where: any = {}
    if (status) {
      where.status = status
    }

    const [reports, total] = await Promise.all([
      this.prisma.userCommentReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      this.prisma.userCommentReport.count({ where }),
    ])

    return { list: reports, total }
  }

  /**
   * 处理举报（管理员）
   */
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
