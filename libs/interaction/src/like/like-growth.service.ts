import { BaseService } from '@libs/base/database'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
} from '@libs/user/growth-ledger'
import { GrowthRuleTypeEnum } from '@libs/user/growth-rule.constant'
import { Injectable } from '@nestjs/common'
import { refreshUserLevelByExperience } from '../user-level.helper'
import { LIKE_GROWTH_RULE_TYPE_MAP, LikeTargetTypeEnum } from './like.constant'

/**
 * 点赞成长奖励服务
 *
 * 功能说明：
 * - 处理点赞操作相关的成长奖励发放
 * - 作品、章节、主题点赞：奖励点赞人（积分+经验值）
 * - 评论点赞：奖励评论作者（保持与历史行为一致）
 * - 自动刷新用户等级
 *
 * 奖励规则映射：
 * - 漫画作品点赞 → COMIC_WORK_LIKE
 * - 小说作品点赞 → NOVEL_WORK_LIKE
 * - 漫画章节点赞 → COMIC_CHAPTER_LIKE
 * - 小说章节点赞 → NOVEL_CHAPTER_LIKE
 * - 论坛主题点赞 → TOPIC_LIKED
 * - 评论被点赞 → COMMENT_LIKED
 */
@Injectable()
export class LikeGrowthService extends BaseService {
  constructor(private readonly growthLedgerService: GrowthLedgerService) {
    super()
  }

  /**
   * 点赞创建奖励
   * 根据点赞目标类型发放对应的成长奖励（积分、经验值）
   * - 作品、章节、主题点赞：奖励点赞人
   * - 评论点赞：奖励评论作者
   * @param targetType - 点赞目标类型
   * @param targetId - 目标ID
   * @param userId - 执行点赞的用户ID
   */
  async rewardLikeCreated(
    targetType: LikeTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    if (targetType === LikeTargetTypeEnum.COMMENT) {
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
   * 奖励被点赞的评论作者
   * 查询评论作者并发放积分和经验值奖励
   * @param commentId - 评论ID
   * @param likerUserId - 点赞者用户ID
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

    const baseBizKey = `comment:liked:${commentId}:liker:${likerUserId}:author:${comment.userId}`

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

        const experienceResult = await this.growthLedgerService.applyByRule(
          tx,
          {
            userId: comment.userId,
            assetType: GrowthAssetTypeEnum.EXPERIENCE,
            ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
            bizKey: `${baseBizKey}:EXPERIENCE`,
            remark: `评论被点赞 #${commentId}`,
            targetId: commentId,
          },
        )

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
