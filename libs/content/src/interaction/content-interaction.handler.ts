import { InteractionTargetTypeEnum } from '@libs/base/constant'
import {
  InteractionActionType,
  InteractionEvent,
  InteractionEventEmitter,
} from '@libs/interaction'
import { UserGrowthRewardService } from '@libs/user/growth-reward'
import { GrowthRuleTypeEnum } from '@libs/user/growth-rule.constant'
import { Injectable, OnModuleInit } from '@nestjs/common'

@Injectable()
export class ContentInteractionEventHandler implements OnModuleInit {
  constructor(
    private readonly eventEmitter: InteractionEventEmitter,
    private readonly userGrowthRewardService: UserGrowthRewardService,
  ) {}

  onModuleInit() {
    this.eventEmitter.on(InteractionActionType.LIKE, this.handleLike.bind(this))
    this.eventEmitter.on(
      InteractionActionType.FAVORITE,
      this.handleFavorite.bind(this),
    )
    this.eventEmitter.on(
      InteractionActionType.DOWNLOAD,
      this.handleDownload.bind(this),
    )
  }

  private isWorkType(targetType: InteractionTargetTypeEnum): boolean {
    return (
      targetType === InteractionTargetTypeEnum.COMIC ||
      targetType === InteractionTargetTypeEnum.NOVEL ||
      targetType === InteractionTargetTypeEnum.COMIC_CHAPTER ||
      targetType === InteractionTargetTypeEnum.NOVEL_CHAPTER
    )
  }

  private async handleLike(event: InteractionEvent): Promise<void> {
    if (!this.isWorkType(event.targetType)) {
      return
    }

    const targetId = event.targetId
    const userId = event.userId

    if (
      event.targetType === InteractionTargetTypeEnum.COMIC_CHAPTER ||
      event.targetType === InteractionTargetTypeEnum.NOVEL_CHAPTER
    ) {
      await this.userGrowthRewardService.tryRewardByRule({
        userId,
        ruleType: GrowthRuleTypeEnum.COMIC_CHAPTER_LIKE,
        bizKey: `content:chapter:like:${targetId}:user:${userId}`,
        source: 'content_chapter_like',
        remark: `like chapter #${targetId}`,
        targetType: event.targetType,
        targetId,
      })
    } else {
      const ruleType =
        event.targetType === InteractionTargetTypeEnum.NOVEL
          ? GrowthRuleTypeEnum.NOVEL_WORK_LIKE
          : GrowthRuleTypeEnum.COMIC_WORK_LIKE

      await this.userGrowthRewardService.tryRewardByRule({
        userId,
        ruleType,
        bizKey: `content:work:like:${targetId}:user:${userId}`,
        source: 'content_work_like',
        remark: `like work #${targetId}`,
        targetType: event.targetType,
        targetId,
      })
    }
  }

  private async handleFavorite(event: InteractionEvent): Promise<void> {
    if (!this.isWorkType(event.targetType)) {
      return
    }

    const targetId = event.targetId
    const userId = event.userId

    const ruleType =
      event.targetType === InteractionTargetTypeEnum.NOVEL
        ? GrowthRuleTypeEnum.NOVEL_WORK_FAVORITE
        : GrowthRuleTypeEnum.COMIC_WORK_FAVORITE

    await this.userGrowthRewardService.tryRewardByRule({
      userId,
      ruleType,
      bizKey: `content:work:favorite:${targetId}:user:${userId}`,
      source: 'content_work_favorite',
      remark: `favorite work #${targetId}`,
      targetType: event.targetType,
      targetId,
    })
  }

  private async handleDownload(event: InteractionEvent): Promise<void> {
    if (!this.isWorkType(event.targetType)) {
      return
    }

    const targetId = event.targetId
    const userId = event.userId

    await this.userGrowthRewardService.tryRewardByRule({
      userId,
      ruleType: GrowthRuleTypeEnum.COMIC_CHAPTER_DOWNLOAD,
      bizKey: `content:chapter:download:${targetId}:user:${userId}`,
      source: 'content_chapter_download',
      remark: `download chapter #${targetId}`,
      targetType: event.targetType,
      targetId,
    })
  }
}
