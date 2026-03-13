import type { Prisma } from '@libs/platform/database'
import type {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
} from '../../notification/notification.constant'
import type { MessageOutboxDomainEnum } from '../outbox.constant'

/**
 * 通知发件箱载荷接口
 * 定义通知事件的数据结构
 */
export interface NotificationOutboxPayload {
  /** 接收用户ID */
  receiverUserId: number
  /** 触发用户ID */
  actorUserId?: number
  /** 通知类型 */
  type: MessageNotificationTypeEnum
  /** 目标类型 */
  targetType?: number
  /** 目标ID */
  targetId?: number
  /** 主体类型 */
  subjectType?: MessageNotificationSubjectTypeEnum
  /** 主体ID */
  subjectId?: number
  /** 通知标题 */
  title: string
  /** 通知内容 */
  content: string
  /** 扩展载荷 */
  payload?: Prisma.InputJsonValue
  /** 聚合键 */
  aggregateKey?: string
  /** 聚合计数 */
  aggregateCount?: number
  /** 过期时间 */
  expiredAt?: Date | string
}

/**
 * 创建消息发件箱事件数据传输对象
 */
export interface CreateMessageOutboxEventDto {
  /** 领域类型 */
  domain: MessageOutboxDomainEnum
  /** 事件类型 */
  eventType: number
  /** 业务幂等键 */
  bizKey: string
  /** 事件载荷 */
  payload: Prisma.InputJsonValue
}

/**
 * 创建通知发件箱事件数据传输对象
 */
export interface CreateNotificationOutboxEventDto {
  /** 事件类型 */
  eventType: MessageNotificationTypeEnum
  /** 业务幂等键 */
  bizKey: string
  /** 通知载荷 */
  payload: NotificationOutboxPayload
}
