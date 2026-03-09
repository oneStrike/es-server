import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import { Injectable } from '@nestjs/common'

@Injectable()
export class LikeInteractionService extends BaseService {
  constructor(private readonly messageOutboxService: MessageOutboxService) {
    super()
  }

  async handleLikeCreated(
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
        eventType: MessageNotificationTypeEnum.COMMENT_LIKE,
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

    if (targetType === InteractionTargetTypeEnum.FORUM_TOPIC) {
      const topic = await tx.forumTopic.findUnique({
        where: { id: targetId, deletedAt: null },
        select: { userId: true },
      })

      if (!topic || topic.userId === userId) {
        return null
      }

      return {
        bizKey: `notify:like:${targetType}:${targetId}:actor:${userId}:receiver:${topic.userId}`,
        payload: {
          receiverUserId: topic.userId,
          actorUserId: userId,
          type: MessageNotificationTypeEnum.COMMENT_LIKE,
          targetType,
          targetId,
          title: '你的主题收到点赞',
          content: '有人点赞了你的主题',
        },
      }
    }

    if (targetType === InteractionTargetTypeEnum.COMMENT) {
      const comment = await tx.userComment.findUnique({
        where: { id: targetId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          targetType: true,
          targetId: true,
        },
      })

      if (!comment || comment.userId === userId) {
        return null
      }

      return {
        bizKey: `notify:comment:like:${comment.id}:actor:${userId}:receiver:${comment.userId}`,
        payload: {
          receiverUserId: comment.userId,
          actorUserId: userId,
          type: MessageNotificationTypeEnum.COMMENT_LIKE,
          targetType: comment.targetType,
          targetId: comment.targetId,
          subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
          subjectId: comment.id,
          title: '你的评论收到点赞',
          content: '有人点赞了你的评论',
        },
      }
    }

    return null
  }
}
