import { BaseService } from '@libs/base/database'
import {
  GrowthAssetTypeEnum,
GrowthLedgerService
} from '@libs/user/growth-ledger'
import { GrowthRuleTypeEnum } from '@libs/user/growth-rule.constant'
import { Injectable } from '@nestjs/common'

/**
 * 评论成长结算服务
 *
 * 约束：
 * 1. 必须在业务事务内调用，保证评论行为与成长结算原子一致
 * 2. 仅处理评论相关奖励，其他业务由对应模块负责
 */
@Injectable()
export class CommentGrowthService extends BaseService {
  constructor(
    private readonly growthLedgerService: GrowthLedgerService,
  ) {
    super()
  }

  /**
   * 评论发布奖励（积分 + 经验）
   */
  async rewardCommentCreated(
    tx: any,
    params: {
      userId: number
      commentId: number
      targetType: number
      targetId: number
    },
  ) {
    const { userId, commentId, targetType, targetId } = params
    const baseBizKey = `comment:create:${commentId}:user:${userId}`

    // 积分奖励：规则不存在/未启用时不会抛错，保持主流程稳定
    await this.growthLedgerService.applyByRule(tx, {
      userId,
      assetType: GrowthAssetTypeEnum.POINTS,
      ruleType: GrowthRuleTypeEnum.CREATE_COMMENT,
      bizKey: `${baseBizKey}:POINTS`,
      source: 'comment',
      remark: `发表评论 #${commentId}`,
      targetType,
      targetId: commentId,
      context: { targetId },
    })

    // 经验奖励：命中后尝试同步刷新等级
    const experienceResult = await this.growthLedgerService.applyByRule(tx, {
      userId,
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      ruleType: GrowthRuleTypeEnum.CREATE_COMMENT,
      bizKey: `${baseBizKey}:EXPERIENCE`,
      source: 'comment',
      remark: `发表评论 #${commentId}`,
      targetType,
      targetId: commentId,
      context: { targetId },
    })

    if (experienceResult.success && experienceResult.afterValue !== undefined) {
      await this.refreshLevelByExperience(tx, userId, experienceResult.afterValue)
    }
  }

  /**
   * 评论被点赞奖励（发给评论作者）
   */
  async rewardCommentLiked(
    tx: any,
    params: {
      commentId: number
      authorUserId: number
      likerUserId: number
    },
  ) {
    const { commentId, authorUserId, likerUserId } = params

    // 自赞不奖励，避免无意义循环发放
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
      source: 'comment_like',
      remark: `评论被点赞 #${commentId}`,
      targetId: commentId,
    })

    const experienceResult = await this.growthLedgerService.applyByRule(tx, {
      userId: authorUserId,
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
      bizKey: `${baseBizKey}:EXPERIENCE`,
      source: 'comment_like',
      remark: `评论被点赞 #${commentId}`,
      targetId: commentId,
    })

    if (experienceResult.success && experienceResult.afterValue !== undefined) {
      await this.refreshLevelByExperience(
        tx,
        authorUserId,
        experienceResult.afterValue,
      )
    }
  }

  /**
   * 根据经验值刷新用户等级
   */
  private async refreshLevelByExperience(
    tx: any,
    userId: number,
    experience: number,
  ) {
    const levelRule = await tx.userLevelRule.findFirst({
      where: {
        isEnabled: true,
        requiredExperience: { lte: experience },
      },
      orderBy: {
        requiredExperience: 'desc',
      },
      select: { id: true },
    })

    if (!levelRule) {
      return
    }

    await tx.appUser.update({
      where: { id: userId },
      data: { levelId: levelRule.id },
    })
  }
}
