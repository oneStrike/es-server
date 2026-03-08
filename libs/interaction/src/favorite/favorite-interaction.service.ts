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
    const { targetType, targetId, userId } = params
    const receiverUserId = await this.resolveReceiverUserId(
      tx,
      targetType,
      targetId,
    )

    if (!receiverUserId || receiverUserId === userId) {
      return
    }

    await this.messageOutboxService.enqueueNotificationEvent(
      {
        eventType: MessageNotificationTypeEnum.CONTENT_FAVORITE,
        bizKey: `notify:favorite:${targetType}:${targetId}:actor:${userId}:receiver:${receiverUserId}`,
        payload: {
          receiverUserId,
          actorUserId: userId,
          type: MessageNotificationTypeEnum.CONTENT_FAVORITE,
          targetType,
          targetId,
          title: '你的内容被收藏了',
          content: '有人收藏了你的内容',
        },
      },
      tx,
    )
  }

  private async resolveReceiverUserId(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<number | undefined> {
    if (targetType === InteractionTargetTypeEnum.FORUM_TOPIC) {
      const topic = await tx.forumTopic.findUnique({
        where: { id: targetId },
        select: { userId: true },
      })
      return topic?.userId
    }

    return undefined
  }
}

