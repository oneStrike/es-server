import type {
  NotificationUnreadByCategory,
  NotificationUnreadSummary,
} from './notification-unread.type'
import {
  isMessageNotificationCategoryKey,
  MESSAGE_NOTIFICATION_CATEGORY_KEYS,
} from './notification.constant'

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
): NotificationUnreadSummary {
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
