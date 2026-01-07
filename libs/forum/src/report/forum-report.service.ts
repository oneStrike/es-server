import { RepositoryService } from '@libs/base/database'

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateForumReportDto, HandleReportDto, QueryForumReportDto } from './dto/forum-report.dto'
import {
  ForumReportStatusEnum,
  ForumReportTypeEnum,
} from './forum-report.constant'

@Injectable()
export class ForumReportService extends RepositoryService {
  get forumReport() {
    return this.prisma.forumReport
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  async createForumReport(createForumReportDto: CreateForumReportDto) {
    const { reporterId, type, targetId, reason, ...reportData } = createForumReportDto

    const reporter = await this.forumProfile.findUnique({
      where: { id: reporterId },
    })

    if (!reporter) {
      throw new BadRequestException('举报人不存在')
    }

    if (type === ForumReportTypeEnum.TOPIC) {
      const topic = await this.forumTopic.findUnique({
        where: { id: targetId, deletedAt: null },
      })

      if (!topic) {
        throw new NotFoundException('主题不存在')
      }

      if (topic.userId === reporterId) {
        throw new BadRequestException('不能举报自己的主题')
      }
    } else if (type === ForumReportTypeEnum.REPLY) {
      const reply = await this.forumReply.findUnique({
        where: { id: targetId },
      })

      if (!reply) {
        throw new NotFoundException('回复不存在')
      }

      if (reply.profileId === reporterId) {
        throw new BadRequestException('不能举报自己的回复')
      }
    } else if (type === ForumReportTypeEnum.USER) {
      const user = await this.forumProfile.findUnique({
        where: { id: targetId },
      })

      if (!user) {
        throw new NotFoundException('用户不存在')
      }

      if (targetId === reporterId) {
        throw new BadRequestException('不能举报自己')
      }
    }

    const existingReport = await this.forumReport.findFirst({
      where: {
        reporterId,
        type,
        targetId,
        status: {
          in: [
            ForumReportStatusEnum.PENDING,
            ForumReportStatusEnum.PROCESSING,
          ],
        },
      },
    })

    if (existingReport) {
      throw new BadRequestException('您已经举报过该内容，请勿重复举报')
    }

    const report = await this.forumReport.create({
      data: {
        ...reportData,
        reporterId,
        type,
        targetId,
        reason,
        status: ForumReportStatusEnum.PENDING,
      },
    })

    return report
  }

  async getForumReports(queryForumReportDto: QueryForumReportDto) {
    const { type, reason, status, reporterId, pageIndex = 0, pageSize = 15 } = queryForumReportDto

    const where: any = {}

    if (type) {
      where.type = type
    }

    if (reason) {
      where.reason = reason
    }

    if (status) {
      where.status = status
    }

    if (reporterId) {
      where.reporterId = reporterId
    }

    return this.forumReport.findPagination({
      where,
      include: {
        reporter: {
          select: {
            id: true,
            nickname: true,
          },
        },
        handler: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      pageIndex,
      pageSize,
    })
  }

  async getForumReportById(id: number) {
    const report = await this.forumReport.findUnique({
      where: { id },
      include: {
        reporter: {
          select: {
            id: true,
            nickname: true,
          },
        },
        handler: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
    })

    if (!report) {
      throw new NotFoundException('举报记录不存在')
    }

    let targetDetails: any = null

    if (report.type === ForumReportTypeEnum.TOPIC) {
      targetDetails = await this.forumTopic.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          title: true,
          content: true,
        },
      })
    } else if (report.type === ForumReportTypeEnum.REPLY) {
      targetDetails = await this.forumReply.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          content: true,
        },
      })
    } else if (report.type === ForumReportTypeEnum.USER) {
      targetDetails = await this.forumProfile.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          nickname: true,
        },
      })
    }

    return {
      ...report,
      targetDetails,
    }
  }

  async handleReport(handleReportDto: HandleReportDto) {
    const { id, status, handlerId, handlingNote } = handleReportDto

    const report = await this.forumReport.findUnique({
      where: { id },
    })

    if (!report) {
      throw new NotFoundException('举报记录不存在')
    }

    if (report.status !== ForumReportStatusEnum.PENDING && report.status !== ForumReportStatusEnum.PROCESSING) {
      throw new BadRequestException('该举报已处理完成')
    }

    const updatedReport = await this.forumReport.update({
      where: { id },
      data: {
        status: status || ForumReportStatusEnum.PROCESSING,
        handlerId,
        handlingNote,
      },
    })

    return updatedReport
  }

  async updateReportStatus(id: number, status: ForumReportStatusEnum, handlerId?: number, handlingNote?: string) {
    const report = await this.forumReport.findUnique({
      where: { id },
    })

    if (!report) {
      throw new NotFoundException('举报记录不存在')
    }

    const updatedReport = await this.forumReport.update({
      where: { id },
      data: {
        status,
        handlerId,
        handlingNote,
      },
    })

    return updatedReport
  }

  async getReportStatistics() {
    const totalReports = await this.forumReport.count()

    const reportsByStatus = await this.forumReport.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    })

    const reportsByType = await this.forumReport.groupBy({
      by: ['type'],
      _count: {
        type: true,
      },
    })

    const reportsByReason = await this.forumReport.groupBy({
      by: ['reason'],
      _count: {
        reason: true,
      },
    })

    const pendingReports = await this.forumReport.count({
      where: {
        status: ForumReportStatusEnum.PENDING,
      },
    })

    return {
      totalReports,
      pendingReports,
      reportsByStatus: reportsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status
        return acc
      }, {} as Record<string, number>),
      reportsByType: reportsByType.reduce((acc, item) => {
        acc[item.type] = item._count.type
        return acc
      }, {} as Record<string, number>),
      reportsByReason: reportsByReason.reduce((acc, item) => {
        acc[item.reason] = item._count.reason
        return acc
      }, {} as Record<string, number>),
    }
  }

  async deleteForumReport(id: number) {
    const report = await this.forumReport.findUnique({
      where: { id },
    })

    if (!report) {
      throw new NotFoundException('举报记录不存在')
    }

    await this.forumReport.delete({
      where: { id },
    })

    return { success: true }
  }

  async getUserReports(profileId: number, pageIndex = 0, pageSize = 15) {
    return this.forumReport.findPagination({
      where: {
        reporterId: profileId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      pageIndex,
      pageSize,
    })
  }
}
