import type { MessageNotificationCategoryKey } from './notification.constant'
import {
  isMessageNotificationCategoryKey,
  MESSAGE_NOTIFICATION_CATEGORY_KEYS,
} from './notification.constant'

export type NotificationUnreadByCategory = Record<
  MessageNotificationCategoryKey,
  number
>

export interface NotificationUnreadSummary {
  total: number
  byCategory: NotificationUnreadByCategory
}

interface NotificationUnreadCountRow {
  categoryKey: string
  count: number | string | null
}

export function createNotificationUnreadByCategory(
  overrides?: Partial<NotificationUnreadByCategory>,
) {
  const result = {} as NotificationUnreadByCategory

  for (const categoryKey of MESSAGE_NOTIFICATION_CATEGORY_KEYS) {
    result[categoryKey] = Number(overrides?.[categoryKey] ?? 0)
  }

  return result
}

export function buildNotificationUnreadSummary(
  rows: readonly NotificationUnreadCountRow[],
) {
  const byCategory = createNotificationUnreadByCategory()

  for (const row of rows) {
    if (!isMessageNotificationCategoryKey(row.categoryKey)) {
      continue
    }

    byCategory[row.categoryKey] = Number(row.count ?? 0)
  }

  const total = Object.values(byCategory).reduce((sum, count) => sum + count, 0)

  return {
    total,
    byCategory,
  }
}
