import {
  InteractionActionType,
  InteractionEvent,
  InteractionEventEmitter,
  InteractionTargetType,
} from '@libs/interaction'
import { UserGrowthEventService } from '@libs/user/growth-event'
import { Injectable, OnModuleInit } from '@nestjs/common'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumGrowthEventKey } from '../forum-growth-event.constant'

@Injectable()
export class ForumInteractionEventHandler implements OnModuleInit {
  constructor(
    private readonly eventEmitter: InteractionEventEmitter,
    private readonly userGrowthEventService: UserGrowthEventService,
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
  ) {}

  onModuleInit() {
    this.eventEmitter.on(InteractionActionType.LIKE, this.handleLike.bind(this))
    this.eventEmitter.on(InteractionActionType.UNLIKE, this.handleUnlike.bind(this))
    this.eventEmitter.on(InteractionActionType.FAVORITE, this.handleFavorite.bind(this))
    this.eventEmitter.on(InteractionActionType.UNFAVORITE, this.handleUnfavorite.bind(this))
  }

  private isForumTopic(targetType: InteractionTargetType): boolean {
    return targetType === InteractionTargetType.FORUM_TOPIC
  }

  private async handleLike(event: InteractionEvent): Promise<void> {
    if (!this.isForumTopic(event.targetType))
{ return }

    const topicId = event.targetId
    const userId = event.userId

    const topic = await this.forumCounterService.getTopicInfo(topicId)
    if (!topic)
{ return }

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

    await this.userGrowthEventService.handleEvent({
      business: 'forum',
      eventKey: ForumGrowthEventKey.TopicLike,
      userId,
      targetId: topicId,
      occurredAt: event.timestamp,
    })
  }

  private async handleUnlike(event: InteractionEvent): Promise<void> {
    if (!this.isForumTopic(event.targetType))
{ return }

    const topicId = event.targetId
    const userId = event.userId

    const topic = await this.forumCounterService.getTopicInfo(topicId)
    if (!topic)
{ return }

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
    if (!this.isForumTopic(event.targetType))
{ return }

    const topicId = event.targetId
    const userId = event.userId

    const topic = await this.forumCounterService.getTopicInfo(topicId)
    if (!topic)
{ return }

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

    await this.userGrowthEventService.handleEvent({
      business: 'forum',
      eventKey: ForumGrowthEventKey.TopicFavorite,
      userId,
      targetId: topicId,
      occurredAt: event.timestamp,
    })
  }

  private async handleUnfavorite(event: InteractionEvent): Promise<void> {
    if (!this.isForumTopic(event.targetType))
{ return }

    const topicId = event.targetId
    const userId = event.userId

    const topic = await this.forumCounterService.getTopicInfo(topicId)
    if (!topic)
{ return }

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
