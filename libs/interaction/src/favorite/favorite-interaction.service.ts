import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import { Injectable } from '@nestjs/common'

@Injectable()
export class FavoriteInteractionService extends BaseService {
  constructor(private readonly messageOutboxService: MessageOutboxService) {
    super()
  }

  async handleFavoriteCreated(
    tx: any,
    params: {
      targetType: InteractionTargetTypeEnum
      targetId: number
      userId: number
    },
  ): Promise<void> {
    const notification = await this.buildNotificationPayload(tx, params)
    if (!notification) {
      return
    }

    await this.messageOutboxService.enqueueNotificationEvent(
      {
        eventType: MessageNotificationTypeEnum.CONTENT_FAVORITE,
        bizKey: notification.bizKey,
        payload: notification.payload,
      },
      tx,
    )
  }

  private async buildNotificationPayload(
    tx: any,
    params: {
      targetType: InteractionTargetTypeEnum
      targetId: number
      userId: number
    },
  ) {
    const { targetType, targetId, userId } = params

    if (targetType !== InteractionTargetTypeEnum.FORUM_TOPIC) {
      return null
    }

    const topic = await tx.forumTopic.findUnique({
      where: { id: targetId, deletedAt: null },
      select: { userId: true },
    })

    if (!topic || topic.userId === userId) {
      return null
    }

    return {
      bizKey: `notify:favorite:${targetType}:${targetId}:actor:${userId}:receiver:${topic.userId}`,
      payload: {
        receiverUserId: topic.userId,
        actorUserId: userId,
        type: MessageNotificationTypeEnum.CONTENT_FAVORITE,
        targetType,
        targetId,
        title: '你的内容被收藏了',
        content: '有人收藏了你的内容',
      },
    }
  }
}
