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
 */
export interface CreateNotificationOutboxEventInput {
  eventType: MessageNotificationTypeEnum
  bizKey: string
  payload: NotificationOutboxPayload
}
