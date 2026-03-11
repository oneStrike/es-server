import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/user/growth-ledger'
import { GrowthRuleTypeEnum } from '@libs/user/growth-rule.constant'
import { Injectable } from '@nestjs/common'
import { refreshUserLevelByExperience } from '../user-level.helper'
import { LIKE_GROWTH_RULE_TYPE_MAP } from './like.constant'

/**
 * 点赞成长奖励服务。
 *
 * 说明：
 * - 作品、章节、主题点赞奖励点赞人
 * - 评论点赞奖励评论作者，保持与历史行为一致
 */
@Injectable()
export class LikeGrowthService extends BaseService {
  constructor(private readonly growthLedgerService: GrowthLedgerService) {
    super()
  }

  async rewardLikeCreated(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    if (targetType === InteractionTargetTypeEnum.COMMENT) {
      await this.rewardCommentLiked(targetId, userId)
      return
    }

    const ruleType = LIKE_GROWTH_RULE_TYPE_MAP[targetType]
    if (!ruleType) {
      return
    }

    const baseBizKey = `like:${targetType}:${targetId}:user:${userId}`

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType,
          bizKey: `${baseBizKey}:POINTS`,
          remark: `点赞目标 #${targetId}`,
          targetType,
          targetId,
        })

        const experienceResult = await this.growthLedgerService.applyByRule(
          tx,
          {
            userId,
            assetType: GrowthAssetTypeEnum.EXPERIENCE,
            ruleType,
            bizKey: `${baseBizKey}:EXPERIENCE`,
            remark: `点赞目标 #${targetId}`,
            targetType,
            targetId,
          },
        )

        if (
          experienceResult.success &&
          experienceResult.afterValue !== undefined
        ) {
          await refreshUserLevelByExperience(
            tx,
            userId,
            experienceResult.afterValue,
          )
        }
      })
    } catch {
      // 奖励失败不影响主流程。
    }
  }

  /**
   * 奖励被点赞的评论作者。
   */
  private async rewardCommentLiked(
    commentId: number,
    likerUserId: number,
  ): Promise<void> {
    const comment = await this.prisma.userComment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: { userId: true },
    })

    if (!comment || comment.userId === likerUserId) {
      return
    }

    const baseBizKey =
      `comment:liked:${commentId}:liker:${likerUserId}:author:${comment.userId}`

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId: comment.userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
          bizKey: `${baseBizKey}:POINTS`,
          remark: `评论被点赞 #${commentId}`,
          targetId: commentId,
        })

        const experienceResult = await this.growthLedgerService.applyByRule(tx, {
          userId: comment.userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
          bizKey: `${baseBizKey}:EXPERIENCE`,
          remark: `评论被点赞 #${commentId}`,
          targetId: commentId,
        })

        if (
          experienceResult.success &&
          experienceResult.afterValue !== undefined
        ) {
          await refreshUserLevelByExperience(
            tx,
            comment.userId,
            experienceResult.afterValue,
          )
        }
      })
    } catch {
      // 奖励失败不影响主流程。
    }
  }
}
