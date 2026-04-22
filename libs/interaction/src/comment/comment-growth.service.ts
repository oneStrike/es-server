import type { UserCommentSelect } from '@db/schema'
import type { EventEnvelope } from '@libs/growth/event-definition/event-envelope.type'
import { EventDefinitionConsumerEnum } from '@libs/growth/event-definition/event-definition.constant'
import {
  canConsumeEventEnvelopeByConsumer,
  createDefinedEventEnvelope,
} from '@libs/growth/event-definition/event-envelope.type'
import { GrowthEventBridgeService } from '@libs/growth/growth-reward/growth-event-bridge.service'
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { Injectable } from '@nestjs/common'

@Injectable()
export class CommentGrowthService {
  constructor(
    private readonly growthEventBridgeService: GrowthEventBridgeService,
  ) {}

  async rewardCommentCreated(
    params: Pick<
      UserCommentSelect,
      'userId' | 'id' | 'targetType' | 'targetId'
    > & {
      occurredAt?: Date
      eventEnvelope?: EventEnvelope<GrowthRuleTypeEnum>
    },
  ) {
    const {
      userId,
      id: commentId,
      targetType,
      targetId,
      occurredAt,
      eventEnvelope,
    } = params
    if (
      eventEnvelope &&
      !canConsumeEventEnvelopeByConsumer(
        eventEnvelope,
        EventDefinitionConsumerEnum.GROWTH,
      )
    ) {
      return
    }

    const baseBizKey = `comment:create:${commentId}:user:${userId}`
    const fallbackEventEnvelope = createDefinedEventEnvelope({
      code: GrowthRuleTypeEnum.CREATE_COMMENT,
      subjectId: userId,
      targetId: commentId,
      occurredAt,
      context: {
        commentTargetType: targetType,
        commentTargetId: targetId,
      },
    })

    await this.growthEventBridgeService.dispatchDefinedEvent({
      eventEnvelope: eventEnvelope ?? fallbackEventEnvelope,
      bizKey: baseBizKey,
      source: 'comment',
      targetType,
      targetId,
    })
  }

  async rewardCommentLiked(
    params: Pick<UserCommentSelect, 'id' | 'userId'> & { likerUserId: number },
  ) {
    const { id: commentId, userId: authorUserId, likerUserId } = params

    if (authorUserId === likerUserId) {
      return
    }

    const baseBizKey = `comment:liked:${commentId}:liker:${likerUserId}:author:${authorUserId}`

    const commentLikedEvent = createDefinedEventEnvelope({
      code: GrowthRuleTypeEnum.COMMENT_LIKED,
      subjectId: authorUserId,
      targetId: commentId,
      operatorId: likerUserId,
      context: {
        likerUserId,
      },
    })

    await this.growthEventBridgeService.dispatchDefinedEvent({
      eventEnvelope: commentLikedEvent,
      bizKey: baseBizKey,
      source: 'comment_like',
    })
  }
}
