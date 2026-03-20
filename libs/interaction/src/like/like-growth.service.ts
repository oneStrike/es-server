import { DrizzleService } from '@db/core'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
  GrowthRuleTypeEnum,
} from '@libs/growth'
import { Injectable, Logger } from '@nestjs/common'
import { resolveInteractionGrowthRuleType } from '../interaction-target-growth-rule'
import { mapLikeTargetTypeToInteractionTargetType } from './like-target.mapping'
import { LikeTargetTypeEnum } from './like.constant'

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
export class LikeGrowthService {
  private readonly logger = new Logger(LikeGrowthService.name)

  constructor(
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
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

    const interactionTargetType =
      mapLikeTargetTypeToInteractionTargetType(targetType)
    const ruleType = resolveInteractionGrowthRuleType(
      'like',
      interactionTargetType,
    )
    if (!ruleType) {
      return
    }

    const baseBizKey = `like:${targetType}:${targetId}:user:${userId}`

    try {
      await this.drizzle.withTransaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType,
          bizKey: `${baseBizKey}:POINTS`,
          remark: `点赞目标 #${targetId}`,
          targetType,
          targetId,
        })

        await this.growthLedgerService.applyByRule(tx, {
          userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType,
          bizKey: `${baseBizKey}:EXPERIENCE`,
          remark: `点赞目标 #${targetId}`,
          targetType,
          targetId,
        })
      })
    } catch (error) {
      this.logger.warn(
        `reward_like_created_failed userId=${userId} targetType=${targetType} targetId=${targetId} ruleType=${ruleType} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
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
    const comment = await this.db.query.userComment.findFirst({
      where: { id: commentId, deletedAt: { isNull: true } },
      columns: { userId: true },
    })

    if (!comment || comment.userId === likerUserId) {
      return
    }

    const baseBizKey = `comment:liked:${commentId}:liker:${likerUserId}:author:${comment.userId}`

    try {
      await this.drizzle.withTransaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId: comment.userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
          bizKey: `${baseBizKey}:POINTS`,
          remark: `评论被点赞 #${commentId}`,
          targetId: commentId,
        })

        await this.growthLedgerService.applyByRule(tx, {
          userId: comment.userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
          bizKey: `${baseBizKey}:EXPERIENCE`,
          remark: `评论被点赞 #${commentId}`,
          targetId: commentId,
        })
      })
    } catch (error) {
      this.logger.warn(
        `reward_comment_liked_failed commentId=${commentId} likerUserId=${likerUserId} authorUserId=${comment.userId} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
