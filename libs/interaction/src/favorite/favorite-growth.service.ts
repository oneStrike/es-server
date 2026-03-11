import { BaseService } from '@libs/base/database'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/user/growth-ledger'
import { Injectable } from '@nestjs/common'
import { refreshUserLevelByExperience } from '../user-level.helper'
import {
  FAVORITE_GROWTH_RULE_TYPE_MAP,
  FavoriteTargetTypeEnum,
} from './favorite.constant'

/**
 * 收藏成长服务
 * 负责处理收藏操作带来的积分和经验值奖励
 */
@Injectable()
export class FavoriteGrowthService extends BaseService {
  constructor(private readonly growthLedgerService: GrowthLedgerService) {
    super()
  }

  /**
   * 收藏成功后发放成长奖励
   * @param targetType 目标类型
   * @param targetId 目标 ID
   * @param userId 用户 ID
   */
  async rewardFavoriteCreated(
    tx: any,
    targetType: FavoriteTargetTypeEnum,
    targetId: number,
    userId: number,
  ) {
    const ruleType = FAVORITE_GROWTH_RULE_TYPE_MAP[targetType]
    const baseBizKey = `favorite:${targetType}:${targetId}:user:${userId}`

    try {
      await this.growthLedgerService.applyByRule(tx, {
        userId,
        assetType: GrowthAssetTypeEnum.POINTS,
        ruleType,
        bizKey: `${baseBizKey}:POINTS`,
        targetType,
        targetId,
      })

      const experienceResult = await this.growthLedgerService.applyByRule(tx, {
        userId,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        ruleType,
        bizKey: `${baseBizKey}:EXPERIENCE`,
        targetType,
        targetId,
      })

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
    } catch {
      // 奖励失败不影响主流程
    }
  }
}
