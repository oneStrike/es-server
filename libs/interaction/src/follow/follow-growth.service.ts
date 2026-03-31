import { DrizzleService } from '@db/core'
import { createDefinedEventEnvelope } from '@libs/growth/event-definition'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { GrowthEventBridgeService } from '@libs/growth/growth-reward'
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
    private readonly growthEventBridgeService: GrowthEventBridgeService,
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
    const followCreatedEvent = createDefinedEventEnvelope({
      code: GrowthRuleTypeEnum.FOLLOW_USER,
      subjectId: userId,
      targetId,
      operatorId: userId,
      context: {
        followedUserId: targetId,
      },
    })
    const beFollowedEvent = createDefinedEventEnvelope({
      code: GrowthRuleTypeEnum.BE_FOLLOWED,
      subjectId: targetId,
      targetId: userId,
      operatorId: userId,
      context: {
        actorUserId: userId,
        followedUserId: targetId,
      },
    })

    try {
      await this.drizzle.withTransaction(async (tx) => {
        await this.growthEventBridgeService.dispatchDefinedEvent({
          tx,
          eventEnvelope: followCreatedEvent,
          bizKey: actorBizKeyBase,
          source: 'follow',
          targetType,
        })

        await this.growthEventBridgeService.dispatchDefinedEvent({
          tx,
          eventEnvelope: beFollowedEvent,
          bizKey: targetBizKeyBase,
          source: 'follow',
          targetType,
          targetId: userId,
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
