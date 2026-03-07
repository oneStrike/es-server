import { InteractionTargetTypeEnum } from '@libs/base/constant'
import {
  InteractionActionType,
  InteractionEvent,
  InteractionEventEmitter,
} from '@libs/interaction'
import { UserGrowthRewardService } from '@libs/user/growth-reward'
import { GrowthRuleTypeEnum } from '@libs/user/growth-rule.constant'
import { Injectable, OnModuleInit } from '@nestjs/common'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumCounterService } from '../counter/forum-counter.service'

@Injectable()
export class ForumInteractionEventHandler implements OnModuleInit {
  constructor(
    private readonly eventEmitter: InteractionEventEmitter,
    private readonly userGrowthRewardService: UserGrowthRewardService,
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
  ) {}

  onModuleInit() {
    this.eventEmitter.on(InteractionActionType.LIKE, this.handleLike.bind(this))
    this.eventEmitter.on(
      InteractionActionType.UNLIKE,
      this.handleUnlike.bind(this),
    )
    this.eventEmitter.on(
      InteractionActionType.FAVORITE,
      this.handleFavorite.bind(this),
    )
    this.eventEmitter.on(
      InteractionActionType.UNFAVORITE,
      this.handleUnfavorite.bind(this),
    )
  }

  private isForumTopic(targetType: InteractionTargetTypeEnum): boolean {
    return targetType === InteractionTargetTypeEnum.FORUM_TOPIC
  }

  private async handleLike(event: InteractionEvent): Promise<void> {
    if (!this.isForumTopic(event.targetType)) {
      return
    }

    const topicId = event.targetId
    const userId = event.userId

    const topic = await this.forumCounterService.getTopicInfo(topicId)
    if (!topic) {
      return
    }

    await this.forumCounterService.updateTopicLikeRelatedCounts(
      {} as any,
      topicId,
      topic.userId,
      1,
    )

    await this.actionLogService.createActionLog({
      userId,
      actionType: ForumUserActionTypeEnum.LIKE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: topicId,
    })

    await this.userGrowthRewardService.tryRewardByRule({
      userId,
      ruleType: GrowthRuleTypeEnum.TOPIC_LIKED,
      bizKey: `forum:topic:like:${topicId}:user:${userId}`,
      source: 'forum_topic_like',
      remark: `like forum topic #${topicId}`,
      targetId: topicId,
    })
  }

  private async handleUnlike(event: InteractionEvent): Promise<void> {
    if (!this.isForumTopic(event.targetType)) {
      return
    }

    const topicId = event.targetId
    const userId = event.userId

    const topic = await this.forumCounterService.getTopicInfo(topicId)
    if (!topic) {
      return
    }

    await this.forumCounterService.updateTopicLikeRelatedCounts(
      {} as any,
      topicId,
      topic.userId,
      -1,
    )

    await this.actionLogService.createActionLog({
      userId,
      actionType: ForumUserActionTypeEnum.UNLIKE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: topicId,
    })
  }

  private async handleFavorite(event: InteractionEvent): Promise<void> {
    if (!this.isForumTopic(event.targetType)) {
      return
    }

    const topicId = event.targetId
    const userId = event.userId

    const topic = await this.forumCounterService.getTopicInfo(topicId)
    if (!topic) {
      return
    }

    await this.forumCounterService.updateTopicFavoriteRelatedCounts(
      {} as any,
      topicId,
      topic.userId,
      1,
    )

    await this.actionLogService.createActionLog({
      userId,
      actionType: ForumUserActionTypeEnum.FAVORITE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: topicId,
    })

    await this.userGrowthRewardService.tryRewardByRule({
      userId,
      ruleType: GrowthRuleTypeEnum.TOPIC_FAVORITED,
      bizKey: `forum:topic:favorite:${topicId}:user:${userId}`,
      source: 'forum_topic_favorite',
      remark: `favorite forum topic #${topicId}`,
      targetId: topicId,
    })
  }

  private async handleUnfavorite(event: InteractionEvent): Promise<void> {
    if (!this.isForumTopic(event.targetType)) {
      return
    }

    const topicId = event.targetId
    const userId = event.userId

    const topic = await this.forumCounterService.getTopicInfo(topicId)
    if (!topic) {
      return
    }

    await this.forumCounterService.updateTopicFavoriteRelatedCounts(
      {} as any,
      topicId,
      topic.userId,
      -1,
    )

    await this.actionLogService.createActionLog({
      userId,
      actionType: ForumUserActionTypeEnum.UNFAVORITE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: topicId,
    })
  }
}
