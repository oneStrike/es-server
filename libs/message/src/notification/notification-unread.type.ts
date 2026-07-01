import type { MessageNotificationCategoryKey } from './notification.type'

export type NotificationUnreadByCategory = Record<
  MessageNotificationCategoryKey,
  number
>

export interface NotificationUnreadSummary {
  total: number
  byCategory: NotificationUnreadByCategory
}
