import type { StructuredValue } from '@libs/platform/utils'
import type { ChatMessageOutput } from '../chat/chat.type'
import type { NotificationUnreadSummary } from './notification-unread.type'

/**
 * 通知删除实时载荷。
 */
export interface NotificationDeletedPayload {
  id: number
}

/**
 * 通知已读同步实时载荷。
 */
export interface NotificationReadSyncPayload {
  id?: number
  readAt: Date
}

/**
 * 聊天新消息实时载荷。
 * - message 复用聊天统一输出结构，避免 HTTP 回放与 websocket 载荷漂移。
 */
export interface NotificationChatMessageNewPayload {
  conversationId: number
  message: ChatMessageOutput
}

/**
 * 聊天会话摘要更新实时载荷。
 */
export interface NotificationChatConversationUpdatePayload {
  conversationId: number
  unreadCount: number
  lastReadAt?: Date
  lastReadMessageId?: string
  lastMessageId?: string
  lastMessageAt?: Date
  lastSenderId?: number
  lastMessageContent?: string
}

/**
 * 收件箱总未读更新实时载荷。
 */
export interface NotificationInboxSummaryUpdatedPayload {
  notificationUnread: NotificationUnreadSummary
  chatUnreadCount: number
  totalUnreadCount: number
  latestNotification?: StructuredValue
  latestChat?: StructuredValue
}
