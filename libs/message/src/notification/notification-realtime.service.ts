import type { StructuredValue } from '@libs/platform/utils/jsonParse'
import type { UserNotificationDto } from './dto/notification.dto'
import type { NotificationUnreadSummary } from './notification-unread.type'
import { Injectable } from '@nestjs/common'
import { MessageWebSocketService } from './notification-websocket.service'

interface NotificationDeletedPayload {
  id: number
}

interface NotificationReadSyncPayload {
  id?: number
  readAt: Date
}

interface NotificationChatMessageNewPayload {
  conversationId: number
  message: {
    id: string
    conversationId: number
    messageSeq: string
    senderId: number
    messageType: number
    content: string
    payload?: StructuredValue
    createdAt: Date
  }
}

interface NotificationChatConversationUpdatePayload {
  conversationId: number
  unreadCount: number
  lastReadAt?: Date
  lastReadMessageId?: string
  lastMessageId?: string
  lastMessageAt?: Date
  lastSenderId?: number
  lastMessageContent?: string
}

interface NotificationInboxSummaryUpdatedPayload {
  notificationUnread: NotificationUnreadSummary
  chatUnreadCount: number
  totalUnreadCount: number
  latestNotification?: StructuredValue
  latestChat?: StructuredValue
}

@Injectable()
export class MessageNotificationRealtimeService {
  constructor(
    private readonly messageWebSocketService: MessageWebSocketService,
  ) {}

  emitNotificationCreated(userId: number, notification: UserNotificationDto) {
    const receiverUserId = Number(userId)
    if (!Number.isInteger(receiverUserId) || receiverUserId <= 0) {
      return
    }
    this.messageWebSocketService.emitToUser(
      receiverUserId,
      'notification.created',
      notification,
    )
  }

  emitNotificationUpdated(userId: number, notification: UserNotificationDto) {
    const receiverUserId = Number(userId)
    if (!Number.isInteger(receiverUserId) || receiverUserId <= 0) {
      return
    }
    this.messageWebSocketService.emitToUser(
      receiverUserId,
      'notification.updated',
      notification,
    )
  }

  emitNotificationDeleted(userId: number, payload: NotificationDeletedPayload) {
    this.messageWebSocketService.emitToUser(
      userId,
      'notification.deleted',
      payload,
    )
  }

  emitNotificationReadSync(
    userId: number,
    payload: NotificationReadSyncPayload,
  ) {
    this.messageWebSocketService.emitToUser(
      userId,
      'notification.read.sync',
      payload,
    )
  }

  emitChatMessageNew(
    userId: number,
    payload: NotificationChatMessageNewPayload,
  ) {
    this.messageWebSocketService.emitToUser(userId, 'chat.message.new', payload)
  }

  emitChatConversationUpdate(
    userId: number,
    payload: NotificationChatConversationUpdatePayload,
  ) {
    this.messageWebSocketService.emitToUser(
      userId,
      'chat.conversation.update',
      payload,
    )
  }

  emitInboxSummaryUpdated(
    userId: number,
    payload: NotificationInboxSummaryUpdatedPayload,
  ) {
    this.messageWebSocketService.emitToUser(
      userId,
      'inbox.summary.updated',
      payload,
    )
  }
}
