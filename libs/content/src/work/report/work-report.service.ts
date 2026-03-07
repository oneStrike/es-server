import { ReportStatusEnum, ReportTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { ReportService } from '@libs/interaction'
import { UserGrowthRewardService } from '@libs/user/growth-reward'
import { GrowthRuleTypeEnum } from '@libs/user/growth-rule.constant'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  CreateWorkReportDto,
  HandleWorkReportDto,
  QueryWorkReportDto,
} from './dto/work-report.dto'

const WORK_REPORT_TARGET_TYPES = [
  ReportTargetTypeEnum.WORK,
  ReportTargetTypeEnum.WORK_CHAPTER,
] as const

type WorkReportTargetType = (typeof WORK_REPORT_TARGET_TYPES)[number]

@Injectable()
export class WorkReportService extends BaseService {
  constructor(
    private readonly reportService: ReportService,
    private readonly userGrowthRewardService: UserGrowthRewardService,
  ) {
    super()
  }

  private isWorkTargetType(
    targetType: ReportTargetTypeEnum,
  ): targetType is WorkReportTargetType {
    return WORK_REPORT_TARGET_TYPES.includes(targetType as WorkReportTargetType)
  }

  private ensureWorkTargetType(
    targetType: ReportTargetTypeEnum,
  ): WorkReportTargetType {
    if (!this.isWorkTargetType(targetType)) {
      throw new BadRequestException('不支持的作品举报目标类型')
    }
    return targetType
  }

  private async ensureReportTargetExists(
    targetType: WorkReportTargetType,
    targetId: number,
  ) {
    if (targetType === ReportTargetTypeEnum.WORK) {
      const work = await this.prisma.work.findUnique({
        where: { id: targetId, deletedAt: null },
        select: { id: true },
      })
      if (!work) {
        throw new NotFoundException('作品不存在')
      }
      return
    }

    const chapter = await this.prisma.workChapter.findUnique({
      where: { id: targetId, deletedAt: null },
      select: { id: true },
    })
    if (!chapter) {
      throw new NotFoundException('章节不存在')
    }
  }

  async createWorkReport(createWorkReportDto: CreateWorkReportDto) {
    const {
      reporterId,
      targetType = ReportTargetTypeEnum.WORK,
      targetId,
      reason,
      description,
      evidenceUrl,
    } = createWorkReportDto

    const resolvedTargetType = this.ensureWorkTargetType(targetType)

    const reporter = await this.prisma.appUser.findUnique({
      where: { id: reporterId },
      select: { id: true },
    })
    if (!reporter) {
      throw new BadRequestException('举报人不存在')
    }

    await this.ensureReportTargetExists(resolvedTargetType, targetId)

    const duplicateMessage =
      resolvedTargetType === ReportTargetTypeEnum.WORK
        ? '您已经举报过该作品，请勿重复举报'
        : '您已经举报过该章节，请勿重复举报'

    const report = await this.reportService.createReport(
      {
        reporterId,
        targetType: resolvedTargetType,
        targetId,
        reason,
        description,
        evidenceUrl,
        status: ReportStatusEnum.PENDING,
      },
      {
        duplicateMessage,
      },
    )

    await this.userGrowthRewardService.tryRewardByRule({
      userId: reporterId,
      ruleType: GrowthRuleTypeEnum.REPORT_CREATE,
      bizKey: `work:report:create:${report.id}:user:${reporterId}`,
      source: 'work_report',
      remark: `create work report #${report.id}`,
      targetType: resolvedTargetType,
      targetId,
    })

    return report
  }

  async getWorkReports(queryWorkReportDto: QueryWorkReportDto) {
    const {
      targetType,
      reason,
      status,
      reporterId,
      pageIndex = 0,
      pageSize = 15,
    } = queryWorkReportDto

    const where: Record<string, unknown> = {
      targetType: targetType
        ? this.ensureWorkTargetType(targetType)
        : { in: WORK_REPORT_TARGET_TYPES },
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

    return this.reportService.queryReportPage({
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

  async getReportById(id: number) {
    const report = await this.reportService.getReportById(id, {
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

    if (!report || !this.isWorkTargetType(report.targetType)) {
      throw new NotFoundException('举报记录不存在')
    }

    let targetDetails: any = null
    if (report.targetType === ReportTargetTypeEnum.WORK) {
      targetDetails = await this.prisma.work.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          name: true,
          type: true,
          cover: true,
        },
      })
    } else {
      targetDetails = await this.prisma.workChapter.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          title: true,
          workId: true,
          workType: true,
        },
      })
    }

    return {
      ...report,
      targetDetails,
    }
  }

  async handleReport(handleWorkReportDto: HandleWorkReportDto) {
    const { id, status, handlerId, handlingNote } = handleWorkReportDto

    const report = await this.reportService.getReportById(id)
    if (!report || !this.isWorkTargetType(report.targetType)) {
      throw new NotFoundException('举报记录不存在')
    }

    if (
      report.status !== ReportStatusEnum.PENDING &&
      report.status !== ReportStatusEnum.PROCESSING
    ) {
      throw new BadRequestException('该举报已处理完成')
    }

    return this.reportService.updateReport(id, {
      status: status || ReportStatusEnum.PROCESSING,
      handlerId,
      handlingNote,
    })
  }

  async updateReportStatus(
    id: number,
    status: ReportStatusEnum,
    handlerId?: number,
    handlingNote?: string,
  ) {
    const report = await this.reportService.getReportById(id)
    if (!report || !this.isWorkTargetType(report.targetType)) {
      throw new NotFoundException('举报记录不存在')
    }

    return this.reportService.updateReport(id, {
      status,
      handlerId,
      handlingNote,
    })
  }

  async getReportStatistics() {
    const baseWhere = {
      targetType: { in: WORK_REPORT_TARGET_TYPES },
    }

    const totalReports = await this.reportService.countReports(baseWhere)

    const reportsByStatus = await this.reportService.groupReportsBy({
      by: ['status'],
      where: baseWhere,
      _count: {
        status: true,
      },
    })

    const reportsByType = await this.reportService.groupReportsBy({
      by: ['targetType'],
      where: baseWhere,
      _count: {
        targetType: true,
      },
    })

    const reportsByReason = await this.reportService.groupReportsBy({
      by: ['reason'],
      where: baseWhere,
      _count: {
        reason: true,
      },
    })

    const pendingReports = await this.reportService.countReports({
      ...baseWhere,
      status: ReportStatusEnum.PENDING,
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

  async deleteWorkReport(id: number) {
    const report = await this.reportService.getReportById(id)
    if (!report || !this.isWorkTargetType(report.targetType)) {
      throw new NotFoundException('举报记录不存在')
    }

    await this.reportService.deleteReport(id)
    return { success: true }
  }

  async getUserReports(dto: QueryWorkReportDto) {
    const { reporterId, pageIndex = 0, pageSize = 15, ...otherDto } = dto
    const where: Record<string, unknown> = {
      targetType: { in: WORK_REPORT_TARGET_TYPES },
      ...otherDto,
    }

    if (reporterId) {
      where.reporterId = reporterId
    }

    return this.reportService.queryReportPage({
      where: {
        ...where,
        pageIndex,
        pageSize,
      },
      orderBy: {
        createdAt: 'desc',
      },
    } as any)
  }
}
