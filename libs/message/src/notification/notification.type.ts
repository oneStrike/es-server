import type { CreateNotificationFromOutboxResult } from './notification-preference.type'
import type { MessageNotificationTypeEnum } from './notification.constant'

/**
 * 用户通知列表分页查询条件。
 * 支持按已读状态与通知类型筛选。
 */
export interface QueryUserNotificationListInput {
  pageIndex?: number
  pageSize?: number
  isRead?: boolean
  type?: MessageNotificationTypeEnum
}

/**
 * 创建通知返回结构
 * 用于区分真正投递、幂等跳过、自通知跳过和偏好抑制
 */
export type CreateNotificationFromOutboxOutput = CreateNotificationFromOutboxResult
