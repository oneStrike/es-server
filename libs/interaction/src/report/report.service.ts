import type {
  CreateForumSceneReportDto,
  CreateUserReportDto,
  CreateUserReportOptions,
  CreateWorkSceneReportDto,
} from './dto/report.dto'
import { ReportStatusEnum, ReportTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/user/growth-ledger'
import { GrowthRuleTypeEnum } from '@libs/user/growth-rule.constant'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

@Injectable()
export class ReportService extends BaseService {
  constructor(private readonly growthLedgerService: GrowthLedgerService) {
    super()
  }

  private get userReport() {
    return this.prisma.userReport
  }

  async createReport(
    dto: CreateUserReportDto,
    options: CreateUserReportOptions = {},
  ) {
    const { status, ...otherDto } = dto

    try {
      return await this.userReport.create({
        data: {
          ...otherDto,
          status: status ?? ReportStatusEnum.PENDING,
        },
      })
    } catch (error) {
      this.handlePrismaBusinessError(error, {
        duplicateMessage:
          options.duplicateMessage ??
          '您已经举报过该内容，请勿重复举报',
      })
    }
  }

  async createWorkReport(dto: CreateWorkSceneReportDto) {
    const {
      reporterId,
      targetType = ReportTargetTypeEnum.WORK,
      targetId,
      reason,
      description,
      evidenceUrl,
    } = dto

    if (
      targetType !== ReportTargetTypeEnum.WORK &&
      targetType !== ReportTargetTypeEnum.WORK_CHAPTER
    ) {
      throw new BadRequestException('不支持的作品举报目标类型')
    }

    await this.ensureReporterExists(reporterId)
    await this.ensureWorkTargetExists(targetType, targetId)

    const duplicateMessage =
      targetType === ReportTargetTypeEnum.WORK
        ? '您已经举报过该作品，请勿重复举报'
        : '您已经举报过该章节，请勿重复举报'

    const report = await this.createReport(
      {
        reporterId,
        targetType,
        targetId,
        reason,
        description,
        evidenceUrl,
        status: ReportStatusEnum.PENDING,
      },
      { duplicateMessage },
    )

    await this.tryRewardReportCreated({
      reportId: report.id,
      reporterId,
      targetType,
      targetId,
      source: 'work_report',
    })

    return report
  }

  async createForumReport(dto: CreateForumSceneReportDto) {
    const { reporterId, targetType, targetId, reason, description, evidenceUrl } =
      dto

    if (
      targetType !== ReportTargetTypeEnum.FORUM_TOPIC &&
      targetType !== ReportTargetTypeEnum.FORUM_REPLY &&
      targetType !== ReportTargetTypeEnum.USER
    ) {
      throw new BadRequestException('不支持的社区举报目标类型')
    }

    await this.ensureReporterExists(reporterId)
    await this.ensureForumTargetExists(targetType, targetId, reporterId)

    const report = await this.createReport(
      {
        reporterId,
        targetType,
        targetId,
        reason,
        description,
        evidenceUrl,
        status: ReportStatusEnum.PENDING,
      },
      {
        duplicateMessage: '您已经举报过该内容，请勿重复举报',
      },
    )

    await this.tryRewardReportCreated({
      reportId: report.id,
      reporterId,
      targetType,
      targetId,
      source: 'forum_report',
    })

    return report
  }

  async getReportById(
    id: number,
    options?: {
      include?: any
      select?: any
    },
  ) {
    return this.userReport.findUnique({
      where: { id },
      ...(options ?? {}),
    })
  }

  async queryReportPage(options: any) {
    return this.userReport.findPagination(options)
  }

  async updateReport(id: number, data: Record<string, unknown>) {
    return this.userReport.update({
      where: { id },
      data,
    })
  }

  async deleteReport(id: number) {
    return this.userReport.delete({
      where: { id },
    })
  }

  async countReports(where?: Record<string, unknown>) {
    return this.userReport.count({ where })
  }

  async groupReportsBy(options: any) {
    return this.userReport.groupBy(options)
  }

  private async ensureReporterExists(reporterId: number) {
    const reporter = await this.prisma.appUser.findUnique({
      where: { id: reporterId },
      select: { id: true },
    })
    if (!reporter) {
      throw new BadRequestException('举报人不存在')
    }
  }

  private async ensureWorkTargetExists(
    targetType: ReportTargetTypeEnum.WORK | ReportTargetTypeEnum.WORK_CHAPTER,
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

  private async ensureForumTargetExists(
    targetType:
      | ReportTargetTypeEnum.FORUM_TOPIC
      | ReportTargetTypeEnum.FORUM_REPLY
      | ReportTargetTypeEnum.USER,
    targetId: number,
    reporterId: number,
  ) {
    if (targetType === ReportTargetTypeEnum.FORUM_TOPIC) {
      const topic = await this.prisma.forumTopic.findUnique({
        where: { id: targetId, deletedAt: null },
        select: { userId: true },
      })
      if (!topic) {
        throw new NotFoundException('主题不存在')
      }
      if (topic.userId === reporterId) {
        throw new BadRequestException('不能举报自己的主题')
      }
      return
    }

    if (targetType === ReportTargetTypeEnum.FORUM_REPLY) {
      const reply = await this.prisma.userComment.findUnique({
        where: { id: targetId },
        select: { userId: true },
      })
      if (!reply) {
        throw new NotFoundException('回复不存在')
      }
      if (reply.userId === reporterId) {
        throw new BadRequestException('不能举报自己的回复')
      }
      return
    }

    const user = await this.prisma.appUser.findUnique({
      where: { id: targetId },
      select: { id: true },
    })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    if (targetId === reporterId) {
      throw new BadRequestException('不能举报自己')
    }
  }

  private async tryRewardReportCreated(params: {
    reportId: number
    reporterId: number
    targetType: number
    targetId: number
    source: string
  }) {
    const { reportId, reporterId, targetType, targetId, source } = params
    const baseBizKey = `${source}:create:${reportId}:user:${reporterId}`

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId: reporterId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType: GrowthRuleTypeEnum.REPORT_CREATE,
          bizKey: `${baseBizKey}:POINTS`,
          source,
          remark: `创建举报 #${reportId}`,
          targetType,
          targetId,
        })

        const expResult = await this.growthLedgerService.applyByRule(tx, {
          userId: reporterId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType: GrowthRuleTypeEnum.REPORT_CREATE,
          bizKey: `${baseBizKey}:EXPERIENCE`,
          source,
          remark: `创建举报 #${reportId}`,
          targetType,
          targetId,
        })

        if (expResult.success && expResult.afterValue !== undefined) {
          const levelRule = await tx.userLevelRule.findFirst({
            where: {
              isEnabled: true,
              requiredExperience: { lte: expResult.afterValue },
            },
            orderBy: {
              requiredExperience: 'desc',
            },
            select: { id: true },
          })

          if (levelRule) {
            await tx.appUser.update({
              where: { id: reporterId },
              data: { levelId: levelRule.id },
            })
          }
        }
      })
    } catch {
      // 举报创建不应因奖励错误而失败
    }
  }
}
