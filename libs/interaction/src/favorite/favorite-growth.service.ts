import { DrizzleService } from '@db/core'
import { createDefinedEventEnvelope } from '@libs/growth/event-definition'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { GrowthEventBridgeService } from '@libs/growth/growth-reward'
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
    private readonly growthEventBridgeService: GrowthEventBridgeService,
    private readonly drizzle: DrizzleService,
  ) {}

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
    const favoriteCreatedEvent = createDefinedEventEnvelope({
      code: ruleType,
      subjectId: userId,
      targetId,
      context: {
        favoriteTargetType: targetType,
      },
    })

    try {
      await this.drizzle.withTransaction(async (tx) => {
        await this.growthEventBridgeService.dispatchDefinedEvent({
          tx,
          eventEnvelope: favoriteCreatedEvent,
          bizKey: baseBizKey,
          source: 'favorite',
          targetType,
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
