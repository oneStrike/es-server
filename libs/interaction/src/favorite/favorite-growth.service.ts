import { DrizzleService } from '@db/core'
import { GrowthAssetTypeEnum, GrowthLedgerService } from '@libs/growth'
import { Injectable, Logger } from '@nestjs/common'
import {
  FAVORITE_GROWTH_RULE_TYPE_MAP,
  FavoriteTargetTypeEnum,
} from './favorite.constant'

/**
 * 收藏成长服务
 * 负责处理收藏操作带来的积分和经验值奖励
 */
@Injectable()
export class FavoriteGrowthService {
  private readonly logger = new Logger(FavoriteGrowthService.name)

  constructor(
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 收藏成功后发放成长奖励
   * @param targetType 目标类型
   * @param targetId 目标 ID
   * @param userId 用户 ID
   */
  async rewardFavoriteCreated(
    targetType: FavoriteTargetTypeEnum,
    targetId: number,
    userId: number,
  ) {
    const ruleType = FAVORITE_GROWTH_RULE_TYPE_MAP[targetType]
    const baseBizKey = `favorite:${targetType}:${targetId}:user:${userId}`

    try {
      await this.db.transaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType,
          bizKey: `${baseBizKey}:POINTS`,
          targetType,
          targetId,
        })

        await this.growthLedgerService.applyByRule(tx, {
          userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType,
          bizKey: `${baseBizKey}:EXPERIENCE`,
          targetType,
          targetId,
        })
      })
    } catch (error) {
      this.logger.warn(
        `reward_favorite_created_failed userId=${userId} targetType=${targetType} targetId=${targetId} ruleType=${ruleType ?? 'undefined'} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
