import { Injectable } from '@nestjs/common'
import type { UserNotificationPublicView } from './notification-public.mapper'
import { MessageWebSocketService } from './notification-websocket.service'

@Injectable()
export class MessageNotificationRealtimeService {
  constructor(
    private readonly messageWebSocketService: MessageWebSocketService,
  ) {}

  emitNotificationCreated(notification: UserNotificationPublicView) {
    const receiverUserId = Number(notification.receiverUserId)
    if (!Number.isInteger(receiverUserId) || receiverUserId <= 0) {
      return
    }
    this.messageWebSocketService.emitToUser(
      receiverUserId,
      'notification.created',
      notification,
    )
  }

  emitNotificationUpdated(notification: UserNotificationPublicView) {
    const receiverUserId = Number(notification.receiverUserId)
    if (!Number.isInteger(receiverUserId) || receiverUserId <= 0) {
      return
    }
    this.messageWebSocketService.emitToUser(
      receiverUserId,
      'notification.updated',
      notification,
    )
  }

  emitNotificationDeleted(
    userId: number,
    payload: {
      id: number
    },
  ) {
    this.messageWebSocketService.emitToUser(userId, 'notification.deleted', payload)
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
    this.messageWebSocketService.emitToUser(
      userId,
      'chat.conversation.update',
      payload,
    )
  }

  emitInboxSummaryUpdated(
    userId: number,
    payload: {
      notificationUnreadCount: number
      chatUnreadCount: number
      totalUnreadCount: number
      latestNotification?: unknown
      latestChat?: unknown
    },
  ) {
    this.messageWebSocketService.emitToUser(userId, 'inbox.summary.updated', payload)
  }
}
