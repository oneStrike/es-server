import type {
  CreateReportInputDto,
  CreateUserReportDto,
  CreateUserReportOptions,
} from './dto/report.dto'
import { ReportStatusEnum, ReportTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/user/growth-ledger'
import { GrowthRuleTypeEnum } from '@libs/user/growth-rule.constant'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InteractionTargetResolverService } from '../interaction-target-resolver.service'

/**
 * 举报服务。
 *
 * 说明：
 * - 所有举报统一走一个入口
 * - 目标存在性校验、场景维度解析、重复举报拦截全部收敛在此处
 */
@Injectable()
export class ReportService extends BaseService {
  constructor(
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly interactionTargetResolverService: InteractionTargetResolverService,
  ) {
    super()
  }

  /**
   * 获取用户举报表的 Prisma 访问器。
   */
  private get userReport() {
    return this.prisma.userReport
  }

  /**
   * 创建举报。
   *
   * 说明：
   * - controller 只传入直接目标和原因类型
   * - 场景维度与评论层级由解析器自动补齐
   */
  async createReport(
    dto: CreateReportInputDto,
    options: CreateUserReportOptions = {},
  ) {
    const { reporterId, targetType, targetId, reasonType, description, evidenceUrl } =
      dto

    await this.ensureReporterExists(reporterId)

    const targetMeta = await this.interactionTargetResolverService.resolveReportTargetMeta(
      targetType,
      targetId,
    )

    this.ensureCanReportOwnTarget(reporterId, targetMeta.ownerUserId)

    const report = await this.createUserReport(
      {
        reporterId,
        targetType,
        targetId,
        sceneType: targetMeta.sceneType,
        sceneId: targetMeta.sceneId,
        commentLevel: targetMeta.commentLevel,
        reasonType,
        description,
        evidenceUrl,
        status: ReportStatusEnum.PENDING,
      },
      {
        duplicateMessage:
          options.duplicateMessage ?? this.getDuplicateMessage(targetType),
      },
    )

    await this.tryRewardReportCreated({
      reportId: report.id,
      reporterId,
      targetType,
      targetId,
    })

    return report
  }

  /**
   * 根据 ID 获取举报详情。
   */
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

  /**
   * 分页查询举报列表。
   */
  async queryReportPage(options: any) {
    return this.userReport.findPagination(options)
  }

  /**
   * 更新举报记录。
   */
  async updateReport(id: number, data: Record<string, unknown>) {
    return this.userReport.update({
      where: { id },
      data,
    })
  }

  /**
   * 删除举报记录。
   */
  async deleteReport(id: number) {
    return this.userReport.delete({
      where: { id },
    })
  }

  /**
   * 统计举报数量。
   */
  async countReports(where?: Record<string, unknown>) {
    return this.userReport.count({ where })
  }

  /**
   * 分组统计举报数据。
   */
  async groupReportsBy(options: any) {
    return this.userReport.groupBy(options)
  }

  /**
   * 真正执行举报落库。
   *
   * 说明：
   * - 该方法只负责写库，不再承担目标校验职责
   * - 所有校验逻辑必须在 `createReport` 阶段完成
   */
  private async createUserReport(
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
          options.duplicateMessage ?? '您已经举报过该内容，请勿重复举报',
      })
    }
  }

  /**
   * 校验举报人是否存在。
   */
  private async ensureReporterExists(reporterId: number) {
    const reporter = await this.prisma.appUser.findUnique({
      where: { id: reporterId },
      select: { id: true },
    })

    if (!reporter) {
      throw new BadRequestException('举报人不存在')
    }
  }

  /**
   * 拦截举报自己内容的请求。
   *
   * 说明：
   * - 只有能够明确解析出目标拥有者时才拦截
   * - 作品与章节当前未冗余作者归属，因此暂不在此处做自举报判断
   */
  private ensureCanReportOwnTarget(reporterId: number, ownerUserId?: number) {
    if (ownerUserId && ownerUserId === reporterId) {
      throw new BadRequestException('不能举报自己')
    }
  }

  /**
   * 根据目标类型生成更明确的重复举报提示。
   */
  private getDuplicateMessage(targetType: ReportTargetTypeEnum) {
    switch (targetType) {
      case ReportTargetTypeEnum.COMIC:
      case ReportTargetTypeEnum.NOVEL:
        return '您已经举报过该作品，请勿重复举报'
      case ReportTargetTypeEnum.COMIC_CHAPTER:
      case ReportTargetTypeEnum.NOVEL_CHAPTER:
        return '您已经举报过该章节，请勿重复举报'
      case ReportTargetTypeEnum.FORUM_TOPIC:
        return '您已经举报过该主题，请勿重复举报'
      case ReportTargetTypeEnum.COMMENT:
        return '您已经举报过该评论，请勿重复举报'
      case ReportTargetTypeEnum.USER:
        return '您已经举报过该用户，请勿重复举报'
      default:
        return '您已经举报过该内容，请勿重复举报'
    }
  }

  /**
   * 尝试发放举报奖励。
   *
   * 说明：
   * - 奖励失败不能影响举报主流程
   * - 奖励规则依旧沿用现有 `REPORT_CREATE`
   */
  private async tryRewardReportCreated(params: {
    reportId: number
    reporterId: number
    targetType: number
    targetId: number
  }) {
    const { reportId, reporterId, targetType, targetId } = params
    const source = 'report'
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
      // 奖励失败不影响举报主流程。
    }
  }
}
