import type { Db } from '@db/core'
import type { EventEnvelope } from '@libs/growth/event-definition/event-envelope.type';
import { AppUserCommentSelect } from '@db/schema'
import { EventDefinitionConsumerEnum } from '@libs/growth/event-definition/event-definition.type';
import { canConsumeEventEnvelopeByConsumer, createDefinedEventEnvelope } from '@libs/growth/event-definition/event-envelope.type';
import { GrowthEventBridgeService } from '@libs/growth/growth-reward/growth-event-bridge.service';
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant';
import { Injectable } from '@nestjs/common'

@Injectable()
export class CommentGrowthService {
  constructor(
    private readonly growthEventBridgeService: GrowthEventBridgeService,
  ) {}

  async rewardCommentCreated(
    tx: Db,
    params: Pick<AppUserCommentSelect, 'userId' | 'id' | 'targetType' | 'targetId'> & {
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
      eventEnvelope
      && !canConsumeEventEnvelopeByConsumer(
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
      tx,
      eventEnvelope: eventEnvelope ?? fallbackEventEnvelope,
      bizKey: baseBizKey,
      source: 'comment',
      remark: `发表评论 #${commentId}`,
      targetType,
      targetId,
    })
  }

  async rewardCommentLiked(
    tx: Db,
    params: Pick<AppUserCommentSelect, 'id' | 'userId'> & { likerUserId: number },
  ) {
    const { id: commentId, userId: authorUserId, likerUserId } = params

    if (authorUserId === likerUserId) {
      return
    }

    const baseBizKey =
      `comment:liked:${commentId}:liker:${likerUserId}:author:${authorUserId}`

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
      tx,
      eventEnvelope: commentLikedEvent,
      bizKey: baseBizKey,
      source: 'comment_like',
      remark: `评论被点赞 #${commentId}`,
    })
  }
}
