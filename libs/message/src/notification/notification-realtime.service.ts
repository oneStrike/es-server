import type { UserNotification } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { MessageGateway } from './notification.gateway'

/**
 * 消息通知实时服务
 * 通过 WebSocket 向客户端推送实时通知和聊天消息
 */
@Injectable()
export class MessageNotificationRealtimeService {
  constructor(private readonly messageGateway: MessageGateway) {}

  /**
   * 推送新通知
   * 向用户推送新创建的通知
   */
  emitNotificationNew(notification: UserNotification) {
    this.messageGateway.emitToUser(notification.userId, 'notification.new', {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      actorUserId: notification.actorUserId,
      targetType: notification.targetType,
      targetId: notification.targetId,
      subjectType: notification.subjectType,
      subjectId: notification.subjectId,
      title: notification.title,
      content: notification.content,
      payload: notification.payload,
      aggregateKey: notification.aggregateKey,
      aggregateCount: notification.aggregateCount,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })
  }

  /**
   * 推送通知已读同步
   * 通知客户端某条通知已读或全部已读
   */
  emitNotificationReadSync(userId: number, payload: { id?: number, readAt: Date }) {
    this.messageGateway.emitToUser(userId, 'notification.read.sync', payload)
  }

  /**
   * 推送新聊天消息
   * 向用户推送新的聊天消息
   */
  emitChatMessageNew(
    userId: number,
    payload: {
      conversationId: number
      message: {
        id: string
        conversationId: number
        messageSeq: string
        senderId: number
        messageType: number
        content: string
        payload?: unknown
        createdAt: Date
      }
    },
  ) {
    this.messageGateway.emitToUser(userId, 'chat.message.new', payload)
  }

  /**
   * 推送会话更新
   * 通知客户端会话状态变化（未读数、最后消息等）
   */
  emitChatConversationUpdate(
    userId: number,
    payload: {
      conversationId: number
      unreadCount: number
      lastReadAt?: Date
      lastReadMessageId?: string
      lastMessageId?: string
      lastMessageAt?: Date
      lastSenderId?: number
      lastMessageContent?: string
    },
  ) {
    this.messageGateway.emitToUser(userId, 'chat.conversation.update', payload)
  }

  /**
   * 推送收件箱摘要更新
   * 通知客户端收件箱摘要变化
   */
  emitInboxSummaryUpdate(
    userId: number,
    payload: {
      notificationUnreadCount: number
      chatUnreadCount: number
      totalUnreadCount: number
      latestNotification?: unknown
      latestChat?: unknown
    },
  ) {
    this.messageGateway.emitToUser(userId, 'inbox.summary.update', payload)
  }
}
