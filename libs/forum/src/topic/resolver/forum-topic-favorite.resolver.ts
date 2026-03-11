import { BaseService } from '@libs/base/database'
import type { PrismaTransactionClientType } from '@libs/base/database/prisma.types'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
import { IFavoriteTargetResolver } from '@libs/interaction/favorite/interfaces/favorite-target-resolver.interface'
import {
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'

@Injectable()
export class ForumTopicFavoriteResolver
  extends BaseService
  implements IFavoriteTargetResolver, OnModuleInit
{
  readonly targetType = FavoriteTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly favoriteService: FavoriteService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {
    super()
  }

  onModuleInit() {
    this.favoriteService.registerResolver(this)
  }

  async ensureExists(tx: PrismaTransactionClientType, targetId: number) {
    const topic = await tx.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: null,
      },
      select: { userId: true },
    })

    if (!topic) {
      throw new BadRequestException('帖子不存在')
    }

    return { ownerUserId: topic.userId }
  }

  async applyCountDelta(
    tx: PrismaTransactionClientType,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) return

    await tx.forumTopic.applyCountDelta(
      {
        id: targetId,
        deletedAt: null,
      },
      'favoriteCount',
      delta,
    )
  }

  async postFavoriteHook(
    tx: PrismaTransactionClientType,
    targetId: number,
    actorUserId: number,
    options: { ownerUserId?: number },
  ) {
    const { ownerUserId: topicOwnerId } = options

    if (topicOwnerId !== undefined && topicOwnerId !== actorUserId) {
      await this.messageOutboxService.enqueueNotificationEvent(
        {
          eventType: MessageNotificationTypeEnum.CONTENT_FAVORITE,
          bizKey: `notify:favorite:${this.targetType}:${targetId}:actor:${actorUserId}:receiver:${topicOwnerId}`,
          payload: {
            receiverUserId: topicOwnerId,
            actorUserId,
            type: MessageNotificationTypeEnum.CONTENT_FAVORITE,
            targetType: this.targetType,
            targetId,
            title: '你的内容被收藏了',
            content: '有人收藏了你的内容',
          },
        },
        tx,
      )
    }
  }

  async batchGetDetails(targetIds: number[]) {
    if (targetIds.length === 0) return new Map()

    const topics = await this.prisma.forumTopic.findMany({
      where: {
        id: { in: targetIds },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
      },
    })

    return new Map(topics.map((topic) => [topic.id, topic]))
  }
}
