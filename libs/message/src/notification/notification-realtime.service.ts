import type { UserNotification } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { MessageWebSocketService } from './notification-websocket.service'

@Injectable()
export class MessageNotificationRealtimeService {
  constructor(
    private readonly messageWebSocketService: MessageWebSocketService,
  ) {}

  emitNotificationNew(notification: UserNotification) {
    this.messageWebSocketService.emitToUser(notification.userId, 'notification.new', {
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

  emitNotificationReadSync(userId: number, payload: { id?: number, readAt: Date }) {
    this.messageWebSocketService.emitToUser(userId, 'notification.read.sync', payload)
  }

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
    this.messageWebSocketService.emitToUser(userId, 'chat.message.new', payload)
  }

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
    this.messageWebSocketService.emitToUser(userId, 'chat.conversation.update', payload)
  }

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
    this.messageWebSocketService.emitToUser(userId, 'inbox.summary.update', payload)
  }
}
