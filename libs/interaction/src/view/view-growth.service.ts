import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/user/growth-ledger'
import { GrowthRuleTypeEnum } from '@libs/user/growth-rule.constant'
import { Injectable } from '@nestjs/common'

@Injectable()
export class ViewGrowthService extends BaseService {
  constructor(private readonly growthLedgerService: GrowthLedgerService) {
    super()
  }

  async rewardViewRecorded(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    const ruleType = this.resolveRuleType(targetType)
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
          source: 'interaction_view',
          remark: `view target #${targetId}`,
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
            source: 'interaction_view',
            remark: `view target #${targetId}`,
            targetType,
            targetId,
          },
        )

        if (
          experienceResult.success &&
          experienceResult.afterValue !== undefined
        ) {
          await this.refreshLevelByExperience(
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

  private resolveRuleType(
    targetType: InteractionTargetTypeEnum,
  ): GrowthRuleTypeEnum | null {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
        return GrowthRuleTypeEnum.COMIC_WORK_VIEW
      case InteractionTargetTypeEnum.NOVEL:
        return GrowthRuleTypeEnum.NOVEL_WORK_VIEW
      case InteractionTargetTypeEnum.FORUM_TOPIC:
        return GrowthRuleTypeEnum.TOPIC_VIEW
      case InteractionTargetTypeEnum.COMMENT:
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
      default:
        return null
    }
  }

  private async refreshLevelByExperience(
    tx: any,
    userId: number,
    experience: number,
  ): Promise<void> {
    const levelRule = await tx.userLevelRule.findFirst({
      where: {
        isEnabled: true,
        requiredExperience: { lte: experience },
      },
      orderBy: {
        requiredExperience: 'desc',
      },
      select: { id: true },
    })

    if (!levelRule) {
      return
    }

    await tx.appUser.update({
      where: { id: userId },
      data: { levelId: levelRule.id },
    })
  }
}
