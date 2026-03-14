import { InteractionTargetTypeEnum } from '@libs/platform/constant'
import { PlatformService } from '@libs/platform/database'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/growth'
import { Injectable } from '@nestjs/common'
import { resolveInteractionGrowthRuleType } from '../interaction-target-growth-rule'
import { refreshUserLevelByExperience } from '../user-level.helper'

@Injectable()
export class BrowseLogGrowthService extends PlatformService {
  constructor(private readonly growthLedgerService: GrowthLedgerService) {
    super()
  }

  async rewardBrowseLogRecorded(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    const ruleType = resolveInteractionGrowthRuleType('view', targetType)
    if (!ruleType) {
      return
    }

    const baseBizKey = `view:${targetType}:${targetId}:user:${userId}`

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType,
          bizKey: `${baseBizKey}:POINTS`,
          remark: `浏览目标 #${targetId}`,
          targetType,
          targetId,
        })

        const experienceResult = await this.growthLedgerService.applyByRule(
          tx,
          {
            userId,
            assetType: GrowthAssetTypeEnum.EXPERIENCE,
            ruleType,
            bizKey: `${baseBizKey}:EXPERIENCE`,
            remark: `浏览目标 #${targetId}`,
            targetType,
            targetId,
          },
        )

        if (
          experienceResult.success &&
          experienceResult.afterValue !== undefined
        ) {
          await refreshUserLevelByExperience(
            tx,
            userId,
            experienceResult.afterValue,
          )
        }
      })
    } catch {
      // 奖励失败不影响主流程
    }
  }
}
