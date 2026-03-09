import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import { Injectable } from '@nestjs/common'

/**
 * 点赞联动服务。
 *
 * 说明：
 * - 负责点赞后的站内通知等副作用
 * - 评论点赞需要保留评论主体信息，便于消息中心正确跳转
 */
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

  /**
   * 构建点赞通知载荷。
   *
   * 说明：
   * - 目前仅为论坛主题和评论点赞发送通知
   * - 其余内容点赞暂不额外发送消息
   */
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
        where: { id: targetId },
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
          title: '你的主题收到了点赞',
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
          title: '你的评论收到了点赞',
          content: '有人点赞了你的评论',
        },
      }
    }

    return null
  }
}
