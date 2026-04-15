import { createDefinedEventEnvelope } from '@libs/growth/event-definition/event-envelope.type';
import { GrowthEventBridgeService } from '@libs/growth/growth-reward/growth-event-bridge.service';
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant';
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
      await this.growthEventBridgeService.dispatchDefinedEvent({
        eventEnvelope: followCreatedEvent,
        bizKey: actorBizKeyBase,
        source: 'follow',
        targetType,
      })

      await this.growthEventBridgeService.dispatchDefinedEvent({
        eventEnvelope: beFollowedEvent,
        bizKey: targetBizKeyBase,
        source: 'follow',
        targetType,
        targetId: userId,
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
