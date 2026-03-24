import { DrizzleService } from '@db/core'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/growth/growth-ledger'
import { Injectable, Logger } from '@nestjs/common'
import { FavoriteTargetTypeEnum } from './favorite.constant'

/**
 * 收藏成长服务
 * 负责处理收藏操作带来的积分和经验值奖励
 */
@Injectable()
export class FavoriteGrowthService {
  private readonly logger = new Logger(FavoriteGrowthService.name)
  private readonly favoriteGrowthRuleMap: Partial<
    Record<FavoriteTargetTypeEnum, GrowthRuleTypeEnum>
  > = {
    [FavoriteTargetTypeEnum.WORK_COMIC]:
      GrowthRuleTypeEnum.COMIC_WORK_FAVORITE,
    [FavoriteTargetTypeEnum.WORK_NOVEL]:
      GrowthRuleTypeEnum.NOVEL_WORK_FAVORITE,
    [FavoriteTargetTypeEnum.FORUM_TOPIC]:
      GrowthRuleTypeEnum.TOPIC_FAVORITED,
  }

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
    const ruleType = this.favoriteGrowthRuleMap[targetType] ?? null
    if (!ruleType) {
      return
    }
    const baseBizKey = `favorite:${targetType}:${targetId}:user:${userId}`

    try {
      await this.drizzle.withTransaction(async (tx) => {
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
