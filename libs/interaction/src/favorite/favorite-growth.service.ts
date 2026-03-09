import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/user/growth-ledger'
import { Injectable } from '@nestjs/common'
import { resolveInteractionGrowthRuleType } from '../interaction-target-growth-rule'
import { refreshUserLevelByExperience } from '../user-level.helper'

@Injectable()
export class FavoriteGrowthService extends BaseService {
  constructor(private readonly growthLedgerService: GrowthLedgerService) {
    super()
  }

  async rewardFavoriteCreated(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    const ruleType = resolveInteractionGrowthRuleType('favorite', targetType)
    if (!ruleType) {
      return
    }

    const baseBizKey = `favorite:${targetType}:${targetId}:user:${userId}`

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType,
          bizKey: `${baseBizKey}:POINTS`,
          source: 'interaction_favorite',
          remark: `favorite target #${targetId}`,
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
            source: 'interaction_favorite',
            remark: `favorite target #${targetId}`,
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
