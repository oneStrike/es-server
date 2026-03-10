import { BusinessModuleEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import { Injectable } from '@nestjs/common'

/**
 * 收藏互动服务
 * 负责处理收藏操作产生的互动副作用，如消息通知等
 */
@Injectable()
export class FavoriteInteractionService extends BaseService {
  constructor(private readonly messageOutboxService: MessageOutboxService) {
    super()
  }

  /**
   * 收藏成功后触发通知投递
   */
  async handleFavoriteCreated(
    tx: any,
    params: {
      targetType: BusinessModuleEnum
      targetId: number
      userId: number
    },
  ) {
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

  /**
   * 构建通知负载（仅对论坛主题收藏）
   */
  private async buildNotificationPayload(
    tx: any,
    params: {
      targetType: BusinessModuleEnum
      targetId: number
      userId: number
    },
  ) {
    const { targetType, targetId, userId } = params

    if (targetType !== BusinessModuleEnum.FORUM) {
      return null
    }

    // 查询目标作者，避免给自己发通知
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
