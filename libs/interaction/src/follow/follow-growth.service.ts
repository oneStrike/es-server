import { DrizzleService } from '@db/core'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
  GrowthRuleTypeEnum,
} from '@libs/growth'
import { Injectable, Logger } from '@nestjs/common'
import { FollowTargetTypeEnum } from './follow.constant'

/**
 * 关注成长服务
 * 仅对用户关注行为发放成长奖励
 */
@Injectable()
export class FollowGrowthService {
  private readonly logger = new Logger(FollowGrowthService.name)

  constructor(
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly drizzle: DrizzleService,
  ) {}

  /**
   * 关注成功后发放成长奖励
   */
  async rewardFollowCreated(
    targetType: FollowTargetTypeEnum,
    targetId: number,
    userId: number,
  ) {
    if (targetType !== FollowTargetTypeEnum.USER || targetId === userId) {
      return
    }

    const actorBizKeyBase = `follow:user:${targetId}:actor:${userId}`
    const targetBizKeyBase = `be-followed:user:${targetId}:actor:${userId}`

    try {
      await this.drizzle.withTransaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType: GrowthRuleTypeEnum.FOLLOW_USER,
          bizKey: `${actorBizKeyBase}:POINTS`,
          targetType,
          targetId,
          context: {
            followedUserId: targetId,
          },
        })

        await this.growthLedgerService.applyByRule(tx, {
          userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType: GrowthRuleTypeEnum.FOLLOW_USER,
          bizKey: `${actorBizKeyBase}:EXPERIENCE`,
          targetType,
          targetId,
          context: {
            followedUserId: targetId,
          },
        })

        await this.growthLedgerService.applyByRule(tx, {
          userId: targetId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType: GrowthRuleTypeEnum.BE_FOLLOWED,
          bizKey: `${targetBizKeyBase}:POINTS`,
          targetType,
          targetId: userId,
          context: {
            actorUserId: userId,
          },
        })

        await this.growthLedgerService.applyByRule(tx, {
          userId: targetId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType: GrowthRuleTypeEnum.BE_FOLLOWED,
          bizKey: `${targetBizKeyBase}:EXPERIENCE`,
          targetType,
          targetId: userId,
          context: {
            actorUserId: userId,
          },
        })
      })
    } catch (error) {
      this.logger.warn(
        `reward_follow_created_failed userId=${userId} targetType=${targetType} targetId=${targetId} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
