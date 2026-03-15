import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
GrowthRuleTypeEnum
} from '@libs/growth'
import { PlatformService } from '@libs/platform/database'

import { Injectable } from '@nestjs/common'
import { refreshUserLevelByExperience } from '../user-level.helper'

@Injectable()
export class CommentGrowthService extends PlatformService {
  constructor(private readonly growthLedgerService: GrowthLedgerService) {
    super()
  }

  async rewardCommentCreated(
    tx: any,
    params: {
      userId: number
      commentId: number
      targetType: number
      targetId: number
      occurredAt?: Date
    },
  ) {
    const { userId, commentId, targetType, targetId, occurredAt } = params
    const baseBizKey = `comment:create:${commentId}:user:${userId}`

    await this.growthLedgerService.applyByRule(tx, {
      userId,
      assetType: GrowthAssetTypeEnum.POINTS,
      ruleType: GrowthRuleTypeEnum.CREATE_COMMENT,
      bizKey: `${baseBizKey}:POINTS`,
      remark: `发表评论 #${commentId}`,
      targetType,
      targetId: commentId,
      context: { targetId },
      occurredAt,
    })

    const experienceResult = await this.growthLedgerService.applyByRule(tx, {
      userId,
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      ruleType: GrowthRuleTypeEnum.CREATE_COMMENT,
      bizKey: `${baseBizKey}:EXPERIENCE`,
      remark: `发表评论 #${commentId}`,
      targetType,
      targetId: commentId,
      context: { targetId },
      occurredAt,
    })

    if (experienceResult.success && experienceResult.afterValue !== undefined) {
      await refreshUserLevelByExperience(tx, userId, experienceResult.afterValue)
    }
  }

  async rewardCommentLiked(
    tx: any,
    params: {
      commentId: number
      authorUserId: number
      likerUserId: number
    },
  ) {
    const { commentId, authorUserId, likerUserId } = params

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

    const experienceResult = await this.growthLedgerService.applyByRule(tx, {
      userId: authorUserId,
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
      bizKey: `${baseBizKey}:EXPERIENCE`,
      remark: `评论被点赞 #${commentId}`,
      targetId: commentId,
    })

    if (experienceResult.success && experienceResult.afterValue !== undefined) {
      await refreshUserLevelByExperience(
        tx,
        authorUserId,
        experienceResult.afterValue,
      )
    }
  }
}
