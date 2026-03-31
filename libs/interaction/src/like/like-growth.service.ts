import { DrizzleService } from '@db/core'
import { createDefinedEventEnvelope } from '@libs/growth/event-definition'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { GrowthEventBridgeService } from '@libs/growth/growth-reward'
import { Injectable, Logger } from '@nestjs/common'
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
  private readonly likeGrowthRuleMap: Partial<
    Record<LikeTargetTypeEnum, GrowthRuleTypeEnum>
  > = {
    [LikeTargetTypeEnum.WORK_COMIC]: GrowthRuleTypeEnum.COMIC_WORK_LIKE,
    [LikeTargetTypeEnum.WORK_NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_LIKE,
    [LikeTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_LIKED,
    [LikeTargetTypeEnum.WORK_COMIC_CHAPTER]:
      GrowthRuleTypeEnum.COMIC_CHAPTER_LIKE,
    [LikeTargetTypeEnum.WORK_NOVEL_CHAPTER]:
      GrowthRuleTypeEnum.NOVEL_CHAPTER_LIKE,
  }

  constructor(
    private readonly growthEventBridgeService: GrowthEventBridgeService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 构建点赞创建事件 envelope。
   * 统一沉淀点赞类事件的 code / key / target / operator 语义。
   */
  private buildLikeCreatedEventEnvelope(params: {
    ruleType: GrowthRuleTypeEnum
    userId: number
    targetType: LikeTargetTypeEnum
    targetId: number
  }) {
    return createDefinedEventEnvelope({
      code: params.ruleType,
      subjectId: params.userId,
      targetId: params.targetId,
      context: {
        likeTargetType: params.targetType,
      },
    })
  }

  /**
   * 构建评论被点赞事件 envelope。
   * 评论作者是事件主体，点赞人单独放入 operatorId，便于后续通知与治理复用。
   */
  private buildCommentLikedEventEnvelope(params: {
    commentId: number
    authorUserId: number
    likerUserId: number
  }) {
    return createDefinedEventEnvelope({
      code: GrowthRuleTypeEnum.COMMENT_LIKED,
      subjectId: params.authorUserId,
      targetId: params.commentId,
      operatorId: params.likerUserId,
      context: {
        likerUserId: params.likerUserId,
      },
    })
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

    const ruleType = this.likeGrowthRuleMap[targetType] ?? null
    if (!ruleType) {
      return
    }

    const likeCreatedEvent = this.buildLikeCreatedEventEnvelope({
      ruleType,
      userId,
      targetType,
      targetId,
    })
    const baseBizKey = `like:${targetType}:${targetId}:user:${userId}`

    try {
      await this.drizzle.withTransaction(async (tx) => {
        await this.growthEventBridgeService.dispatchDefinedEvent({
          tx,
          eventEnvelope: likeCreatedEvent,
          bizKey: baseBizKey,
          source: 'like',
          remark: `点赞目标 #${likeCreatedEvent.targetId}`,
          targetType,
        })
      })
    } catch (error) {
      this.logger.warn(
        `reward_like_created_failed userId=${userId} targetType=${targetType} targetId=${targetId} ruleType=${ruleType} eventKey=${likeCreatedEvent.key} error=${
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

    const commentLikedEvent = this.buildCommentLikedEventEnvelope({
      commentId,
      authorUserId: comment.userId,
      likerUserId,
    })
    const baseBizKey = `comment:liked:${commentId}:liker:${likerUserId}:author:${comment.userId}`

    try {
      await this.drizzle.withTransaction(async (tx) => {
        await this.growthEventBridgeService.dispatchDefinedEvent({
          tx,
          eventEnvelope: commentLikedEvent,
          bizKey: baseBizKey,
          source: 'comment_like',
          remark: `评论被点赞 #${commentLikedEvent.targetId}`,
        })
      })
    } catch (error) {
      this.logger.warn(
        `reward_comment_liked_failed commentId=${commentId} likerUserId=${likerUserId} authorUserId=${comment.userId} eventKey=${commentLikedEvent.key} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
