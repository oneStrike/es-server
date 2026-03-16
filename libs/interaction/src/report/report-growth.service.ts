import { DrizzleService } from '@db/core'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
  GrowthRuleTypeEnum,
} from '@libs/growth'

import { Injectable } from '@nestjs/common'
import {
  REPORT_GROWTH_RULE_TYPE_MAP,
  ReportTargetTypeEnum,
} from './report.constant'

@Injectable()
export class ReportGrowthService {
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
    targetType: number
    targetId: number
  }): Promise<void> {
    const { reportId, reporterId, targetType, targetId } = params
    const baseBizKey = `report:${reportId}:user:${reporterId}`

    const ruleType =
      REPORT_GROWTH_RULE_TYPE_MAP[targetType as ReportTargetTypeEnum] ??
      GrowthRuleTypeEnum.TOPIC_REPORT

    try {
      await this.db.transaction(async (tx) => {
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
    } catch {
      // 奖励失败不影响主流程。
    }
  }
}
