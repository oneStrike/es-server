import type { NotificationDeliverySelect } from '@db/schema'
import type {
  MessageNotificationDispatchStatusEnum,
  MessageNotificationTypeEnum,
} from './notification.constant'

/**
 * 更新通知投递结果入参
 * 由 worker 在成功、跳过、重试和最终失败时复用，统一更新同一条 delivery 记录
 */
export interface UpsertNotificationDeliveryInput {
  status: MessageNotificationDispatchStatusEnum
  retryCount: number
  notificationId?: number
  failureReason?: string | null
  lastAttemptAt?: Date
}

/**
 * 通知投递结果分页查询入参
 * 供管理端按结果、通知类型、接收用户和业务键排障筛选
 */
export interface QueryNotificationDeliveryPageInput {
  pageIndex?: number
  pageSize?: number
  status?: MessageNotificationDispatchStatusEnum
  notificationType?: MessageNotificationTypeEnum
  receiverUserId?: number
  bizKey?: string
  outboxId?: string
  reminderKind?: string
  taskId?: number
  assignmentId?: number
}

/**
 * 通知投递结果分页项
 * 在表字段基础上补充中文标签，并将 bigint outboxId 映射为字符串以便 API 返回
 */
export interface NotificationDeliveryPageItem
  extends Omit<NotificationDeliverySelect, 'outboxId' | 'status'> {
  outboxId: string
  status: MessageNotificationDispatchStatusEnum
  notificationTypeLabel?: string
  statusLabel: string
  reminderKind?: string
  taskId?: number
  assignmentId?: number
  taskCode?: string
  sceneType?: number
  payloadVersion?: number
}
