import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/growth'
import { PlatformService } from '@libs/platform/database'
import { Injectable } from '@nestjs/common'
import { refreshUserLevelByExperience } from '../user-level.helper'
import {
  BROWSE_LOG_GROWTH_RULE_TYPE_MAP,
  BrowseLogTargetTypeEnum,
} from './browse-log.constant'

/**
 * 浏览日志成长服务
 * 处理浏览记录相关的积分和经验奖励
 */
@Injectable()
export class BrowseLogGrowthService extends PlatformService {
  constructor(
    /** 成长账本服务 */
    private readonly growthLedgerService: GrowthLedgerService,
  ) {
    super()
  }

  /**
   * 奖励浏览记录
   * 根据目标类型发放对应的积分和经验奖励
   *
   * @param targetType - 浏览目标类型
   * @param targetId - 目标ID
   * @param userId - 用户ID
   */
  async rewardBrowseLogRecorded(
    targetType: BrowseLogTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    const ruleType = BROWSE_LOG_GROWTH_RULE_TYPE_MAP[targetType]
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
