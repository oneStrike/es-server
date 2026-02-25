import {
  InteractionActionType,
  InteractionEvent,
  InteractionEventEmitter,
  InteractionTargetType,
} from '@libs/interaction'
import { UserGrowthEventService } from '@libs/user/growth-event'
import { Injectable, OnModuleInit } from '@nestjs/common'

@Injectable()
export class ContentInteractionEventHandler implements OnModuleInit {
  constructor(
    private readonly eventEmitter: InteractionEventEmitter,
    private readonly userGrowthEventService: UserGrowthEventService,
  ) {}

  onModuleInit() {
    this.eventEmitter.on(InteractionActionType.LIKE, this.handleLike.bind(this))
    this.eventEmitter.on(InteractionActionType.FAVORITE, this.handleFavorite.bind(this))
    this.eventEmitter.on(InteractionActionType.DOWNLOAD, this.handleDownload.bind(this))
  }

  private isWorkType(targetType: InteractionTargetType): boolean {
    return (
      targetType === InteractionTargetType.COMIC ||
      targetType === InteractionTargetType.NOVEL ||
      targetType === InteractionTargetType.COMIC_CHAPTER ||
      targetType === InteractionTargetType.NOVEL_CHAPTER
    )
  }

  private async handleLike(event: InteractionEvent): Promise<void> {
    if (!this.isWorkType(event.targetType))
{ return }

    const targetId = event.targetId
    const userId = event.userId

    if (event.targetType === InteractionTargetType.COMIC_CHAPTER ||
      event.targetType === InteractionTargetType.NOVEL_CHAPTER) {
      await this.userGrowthEventService.handleEvent({
        business: 'work',
        eventKey: 'chapter_like',
        userId,
        targetId,
        occurredAt: event.timestamp,
      })
    } else {
      await this.userGrowthEventService.handleEvent({
        business: 'work',
        eventKey: 'work_like',
        userId,
        targetId,
        occurredAt: event.timestamp,
      })
    }
  }

  private async handleFavorite(event: InteractionEvent): Promise<void> {
    if (!this.isWorkType(event.targetType))
{ return }

    const targetId = event.targetId
    const userId = event.userId

    await this.userGrowthEventService.handleEvent({
      business: 'work',
      eventKey: 'work_favorite',
      userId,
      targetId,
      occurredAt: event.timestamp,
    })
  }

  private async handleDownload(event: InteractionEvent): Promise<void> {
    if (!this.isWorkType(event.targetType))
{ return }

    const targetId = event.targetId
    const userId = event.userId

    await this.userGrowthEventService.handleEvent({
      business: 'work',
      eventKey: 'chapter_download',
      userId,
      targetId,
      occurredAt: event.timestamp,
    })
  }
}
