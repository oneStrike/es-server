import type { ChatOutboxEventTypeEnum } from '../chat/chat.constant'
import type {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
} from '../notification/notification.constant'
import type { MessageOutboxDomainEnum } from './outbox.constant'

/**
 * 通知发件箱载荷。
 * - 用于构造通知消息事件的业务内容与聚合信息
 */
export interface NotificationOutboxPayload {
  receiverUserId: number
  actorUserId?: number
  type: MessageNotificationTypeEnum
  targetType?: number
  targetId?: number
  subjectType?: MessageNotificationSubjectTypeEnum
  subjectId?: number
  title: string
  content: string
  payload?: unknown
  aggregateKey?: string
  aggregateCount?: number
  expiredAt?: Date | string
}

/**
 * 创建消息发件箱事件入参。
 * - 用于写入任意领域的 outbox 事件
 */
export interface CreateMessageOutboxEventInput {
  domain: MessageOutboxDomainEnum
  eventType: number
  bizKey: string
  payload: unknown
}

/**
 * 创建通知发件箱事件入参。
 * - 用于写入通知领域 outbox 事件
 * - 兼容期允许继续传 eventType，但真正写库时以 payload.type 为唯一事实源
 */
export interface CreateNotificationOutboxEventInput {
  eventType?: MessageNotificationTypeEnum
  bizKey: string
  payload: NotificationOutboxPayload
}

/**
 * CHAT 域“消息已创建” outbox 载荷。
 * - 只存放最小重放锚点，消费时再从 chat 事实表读取最新状态
 */
export interface ChatMessageCreatedOutboxPayload {
  conversationId: number
  messageId: string
}

/**
 * 创建 CHAT 域“消息已创建” outbox 事件入参。
 * - 继续复用 outbox 幂等键，不把聊天实时推送和通知 delivery 混成一层
 */
export interface CreateChatMessageCreatedOutboxEventInput {
  bizKey: string
  payload: ChatMessageCreatedOutboxPayload
  eventType?: ChatOutboxEventTypeEnum.MESSAGE_CREATED
}
