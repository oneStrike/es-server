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
