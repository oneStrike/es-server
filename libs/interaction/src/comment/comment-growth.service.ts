import type { Db } from '@db/core'
import type { EventEnvelope } from '@libs/growth/event-definition'
import { UserCommentSelect } from '@db/schema'
import {
  canConsumeEventEnvelopeByConsumer,
  EventDefinitionConsumerEnum,
} from '@libs/growth/event-definition'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/growth/growth-ledger'
import { Injectable } from '@nestjs/common'

@Injectable()
export class CommentGrowthService {
  constructor(private readonly growthLedgerService: GrowthLedgerService) {}

  async rewardCommentCreated(
    tx: Db,
    params: Pick<UserCommentSelect, 'userId' | 'id' | 'targetType' | 'targetId'> & {
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

    await this.growthLedgerService.applyByRule(tx, {
      userId,
      assetType: GrowthAssetTypeEnum.POINTS,
      ruleType: GrowthRuleTypeEnum.CREATE_COMMENT,
      bizKey: `${baseBizKey}:POINTS`,
      remark: `发表评论 #${commentId}`,
      targetType,
      targetId,
      context: { targetId },
      occurredAt,
    })

    await this.growthLedgerService.applyByRule(tx, {
      userId,
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      ruleType: GrowthRuleTypeEnum.CREATE_COMMENT,
      bizKey: `${baseBizKey}:EXPERIENCE`,
      remark: `发表评论 #${commentId}`,
      targetType,
      targetId,
      context: { targetId },
      occurredAt,
    })
  }

  async rewardCommentLiked(
    tx: Db,
    params: Pick<UserCommentSelect, 'id' | 'userId'> & { likerUserId: number },
  ) {
    const { id: commentId, userId: authorUserId, likerUserId } = params

    if (authorUserId === likerUserId) {
      return
    }

    const baseBizKey =
      `comment:liked:${commentId}:liker:${likerUserId}:author:${authorUserId}`

    await this.growthLedgerService.applyByRule(tx, {
      userId: authorUserId,
      assetType: GrowthAssetTypeEnum.POINTS,
      ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
      bizKey: `${baseBizKey}:POINTS`,
      remark: `评论被点赞 #${commentId}`,
      targetId: commentId,
    })

    await this.growthLedgerService.applyByRule(tx, {
      userId: authorUserId,
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
      bizKey: `${baseBizKey}:EXPERIENCE`,
      remark: `评论被点赞 #${commentId}`,
      targetId: commentId,
    })
  }
}
