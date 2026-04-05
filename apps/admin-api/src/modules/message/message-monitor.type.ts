import type { QueryNotificationDeliveryPageDto } from '@libs/message/notification'

/**
 * Outbox 监控查询入参。
 * 用于约束监控窗口时长与 TopN 错误条数。
 */
export interface MessageOutboxMonitorQueryInput {
  windowHours?: number
  topErrorsLimit?: number
}

/**
 * WS 监控查询入参。
 * 用于约束聚合窗口时长。
 */
export interface MessageWsMonitorQueryInput {
  windowHours?: number
}

/**
 * 通知投递结果分页查询入参。
 * 管理端直接复用消息域 delivery 查询字段，避免在应用层复制第二套筛选口径。
 */
export type MessageNotificationDeliveryMonitorQueryInput = QueryNotificationDeliveryPageDto
