import { DrizzleService } from '@db/core'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/growth/growth-ledger'
import { Injectable, Logger } from '@nestjs/common'
import { ReportTargetTypeEnum } from './report.constant'

@Injectable()
export class ReportGrowthService {
  private readonly logger = new Logger(ReportGrowthService.name)
  private readonly reportGrowthRuleMap: Partial<
    Record<ReportTargetTypeEnum, GrowthRuleTypeEnum>
  > = {
    [ReportTargetTypeEnum.COMIC]: GrowthRuleTypeEnum.COMIC_WORK_REPORT,
    [ReportTargetTypeEnum.NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_REPORT,
    [ReportTargetTypeEnum.COMIC_CHAPTER]:
      GrowthRuleTypeEnum.COMIC_CHAPTER_REPORT,
    [ReportTargetTypeEnum.NOVEL_CHAPTER]:
      GrowthRuleTypeEnum.NOVEL_CHAPTER_REPORT,
    [ReportTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_REPORT,
    [ReportTargetTypeEnum.COMMENT]: GrowthRuleTypeEnum.COMMENT_REPORT,
  }

  constructor(
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  async rewardReportCreated(params: {
    reportId: number
    reporterId: number
    targetType: ReportTargetTypeEnum
    targetId: number
  }): Promise<void> {
    const { reportId, reporterId, targetType, targetId } = params
    const baseBizKey = `report:${reportId}:user:${reporterId}`

    const ruleType = this.reportGrowthRuleMap[targetType] ?? null
    if (!ruleType) {
      return
    }

    try {
      await this.drizzle.withTransaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId: reporterId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType,
          bizKey: `${baseBizKey}:POINTS`,
          remark: `创建举报 #${reportId}`,
          targetType,
          targetId,
        })

        await this.growthLedgerService.applyByRule(tx, {
          userId: reporterId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType,
          bizKey: `${baseBizKey}:EXPERIENCE`,
          remark: `创建举报 #${reportId}`,
          targetType,
          targetId,
        })
      })
    } catch (error) {
      this.logger.warn(
        `reward_report_created_failed reportId=${reportId} reporterId=${reporterId} targetType=${targetType} targetId=${targetId} ruleType=${ruleType} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
