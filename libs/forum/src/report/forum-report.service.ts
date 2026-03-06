import { ReportStatusEnum, ReportTargetTypeEnum } from '@libs/base/constant'

import { BaseService } from '@libs/base/database'
import { UserGrowthEventService } from '@libs/user/growth-event'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ForumGrowthEventKey } from '../forum-growth-event.constant'
import {
  CreateForumReportDto,
  HandleForumReportDto,
  QueryForumReportDto,
} from './dto/forum-report.dto'
import { ForumReportTypeEnum } from './forum-report.constant'

/**
 * 论坛举报服务类
 * 提供论坛举报的创建、查询、处理、统计等核心业务逻辑
 */
@Injectable()
export class ForumReportService extends BaseService {
  constructor(
    private readonly userGrowthEventService: UserGrowthEventService,
  ) {
    super()
  }

  /**
   * 获取论坛举报模型
   */
  get userReport() {
    return this.prisma.userReport
  }

  /**
   * 获取论坛主题模型
   */
  get forumTopic() {
    return this.prisma.forumTopic
  }

  /**
   * 获取论坛回复模型
   */
  get userComment() {
    return this.prisma.userComment
  }

  /**
   * 创建论坛举报
   * @param createForumReportDto - 创建举报的DTO
   * @returns 创建的举报记录
   * @throws BadRequestException 举报人不存在、不能举报自己、重复举报等情况
   * @throws NotFoundException 目标内容不存在
   */
  async createForumReport(createForumReportDto: CreateForumReportDto) {
    const { reporterId, type, targetType, targetId, reason, ...reportData } =
      createForumReportDto

    const resolvedTargetType =
      targetType ??
      (type === ForumReportTypeEnum.TOPIC
        ? ReportTargetTypeEnum.FORUM_TOPIC
        : type === ForumReportTypeEnum.REPLY
          ? ReportTargetTypeEnum.FORUM_REPLY
          : ReportTargetTypeEnum.USER)

    const reporter = await this.prisma.appUser.findUnique({
      where: { id: reporterId },
    })

    if (!reporter) {
      throw new BadRequestException('举报人不存在')
    }

    if (resolvedTargetType === ReportTargetTypeEnum.FORUM_TOPIC) {
      const topic = await this.forumTopic.findUnique({
        where: { id: targetId, deletedAt: null },
      })

      if (!topic) {
        throw new NotFoundException('主题不存在')
      }

      if (topic.userId === reporterId) {
        throw new BadRequestException('不能举报自己的主题')
      }
    } else if (resolvedTargetType === ReportTargetTypeEnum.FORUM_REPLY) {
      const reply = await this.userComment.findUnique({
        where: { id: targetId },
      })

      if (!reply) {
        throw new NotFoundException('回复不存在')
      }

      if (reply.userId === reporterId) {
        throw new BadRequestException('不能举报自己的回复')
      }
    } else if (resolvedTargetType === ReportTargetTypeEnum.USER) {
      const user = await this.prisma.appUser.findUnique({
        where: { id: targetId },
      })

      if (!user) {
        throw new NotFoundException('用户不存在')
      }

      if (targetId === reporterId) {
        throw new BadRequestException('不能举报自己')
      }
    }

    const existingReport = await this.userReport.findFirst({
      where: {
        reporterId,
        targetType: resolvedTargetType,
        targetId,
        status: {
          in: [ReportStatusEnum.PENDING, ReportStatusEnum.PROCESSING],
        },
      },
    })

    if (existingReport) {
      throw new BadRequestException('您已经举报过该内容，请勿重复举报')
    }

    const report = await this.userReport.create({
      data: {
        ...reportData,
        reporterId,
        targetType: resolvedTargetType,
        targetId,
        reason,
        status: ReportStatusEnum.PENDING,
      },
    })

    await this.userGrowthEventService.handleEvent({
      business: 'forum',
      eventKey: ForumGrowthEventKey.ReportCreate,
      userId: reporterId,
      targetId,
      occurredAt: new Date(),
    })

    return report
  }

  /**
   * 获取论坛举报列表（分页）
   * @param queryForumReportDto - 查询参数，包含类型、原因、状态、举报人ID等过滤条件
   * @returns 分页的举报列表
   */
  async getForumReports(queryForumReportDto: QueryForumReportDto) {
    const {
      targetType,
      reason,
      status,
      reporterId,
      pageIndex = 0,
      pageSize = 15,
    } = queryForumReportDto

    const where: any = {}

    if (targetType) {
      where.targetType = targetType
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

    return this.userReport.findPagination({
      where: {
        ...where,
        pageIndex,
        pageSize,
      },
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
    } as any)
  }

  /**
   * 根据ID获取论坛举报详情
   * @param id - 举报记录ID
   * @returns 包含举报详情和目标内容信息的完整记录
   * @throws NotFoundException 举报记录不存在
   */
  async getReportById(id: number) {
    const report = await this.userReport.findUnique({
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

    // 根据举报类型补充目标内容摘要
    let targetDetails: any = null

    if (report.targetType === ReportTargetTypeEnum.FORUM_TOPIC) {
      targetDetails = await this.forumTopic.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          title: true,
          content: true,
        },
      })
    } else if (report.targetType === ReportTargetTypeEnum.FORUM_REPLY) {
      targetDetails = await this.userComment.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          content: true,
        },
      })
    } else if (report.targetType === ReportTargetTypeEnum.USER) {
      const user = await this.prisma.appUser.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          nickname: true,
        },
      })
      targetDetails = user
    }

    return {
      ...report,
      targetDetails,
    }
  }

  /**
   * 处理举报
   * @param handleReportDto - 处理举报的DTO，包含举报ID、状态、处理人ID和处理备注
   * @returns 更新后的举报记录
   * @throws NotFoundException 举报记录不存在
   * @throws BadRequestException 举报已处理完成
   */
  async handleReport(handleReportDto: HandleForumReportDto) {
    const { id, status, handlerId, handlingNote } = handleReportDto

    const report = await this.userReport.findUnique({
      where: { id },
    })

    if (!report) {
      throw new NotFoundException('举报记录不存在')
    }

    // 仅允许待处理/处理中状态更新
    if (
      report.status !== ReportStatusEnum.PENDING &&
      report.status !== ReportStatusEnum.PROCESSING
    ) {
      throw new BadRequestException('该举报已处理完成')
    }

    const updatedReport = await this.userReport.update({
      where: { id },
      data: {
        status: status || ReportStatusEnum.PROCESSING,
        handlerId,
        handlingNote,
      },
    })

    return updatedReport
  }

  /**
   * 更新举报状态
   * @param id - 举报记录ID
   * @param status - 新的状态
   * @param handlerId - 处理人ID（可选）
   * @param handlingNote - 处理备注（可选）
   * @returns 更新后的举报记录
   * @throws NotFoundException 举报记录不存在
   */
  async updateReportStatus(
    id: number,
    status: ReportStatusEnum,
    handlerId?: number,
    handlingNote?: string,
  ) {
    const report = await this.userReport.findUnique({
      where: { id },
    })

    if (!report) {
      throw new NotFoundException('举报记录不存在')
    }

    const updatedReport = await this.userReport.update({
      where: { id },
      data: {
        status,
        handlerId,
        handlingNote,
      },
    })

    return updatedReport
  }

  /**
   * 获取举报统计数据
   * @returns 包含总举报数、待处理数、按状态/类型/原因分组的统计数据
   */
  async getReportStatistics() {
    const totalReports = await this.userReport.count()

    const reportsByStatus = await this.userReport.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    })

    const reportsByType = await this.userReport.groupBy({
      by: ['targetType'],
      _count: {
        targetType: true,
      },
    })

    const reportsByReason = await this.userReport.groupBy({
      by: ['reason'],
      _count: {
        reason: true,
      },
    })

    const pendingReports = await this.userReport.count({
      where: {
        status: ReportStatusEnum.PENDING,
      },
    })

    return {
      totalReports,
      pendingReports,
      reportsByStatus: reportsByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.status
          return acc
        },
        {} as Record<string, number>,
      ),
      reportsByType: reportsByType.reduce(
        (acc, item) => {
          acc[item.targetType] = item._count.targetType
          return acc
        },
        {} as Record<string, number>,
      ),
      reportsByReason: reportsByReason.reduce(
        (acc, item) => {
          acc[item.reason] = item._count.reason
          return acc
        },
        {} as Record<string, number>,
      ),
    }
  }

  /**
   * 删除论坛举报记录
   * @param id - 举报记录ID
   * @returns 删除成功标识
   * @throws NotFoundException 举报记录不存在
   */
  async deleteForumReport(id: number) {
    const report = await this.userReport.findUnique({
      where: { id },
    })

    if (!report) {
      throw new NotFoundException('举报记录不存在')
    }

    await this.userReport.delete({
      where: { id },
    })

    return { success: true }
  }

  /**
   * 获取指定用户的举报记录
   * @returns 分页的用户举报记录
   */
  async getUserReports(dto: QueryForumReportDto) {
    const { reporterId, ...otherDto } = dto
    return this.userReport.findPagination({
      where: {
        reporter: {
          id: reporterId,
        },
        ...otherDto,
      },
    })
  }
}
