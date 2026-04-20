import type { MessageNotificationCategoryKey } from './notification.constant'
import { isMessageNotificationCategoryKey } from './notification.constant'

const MESSAGE_NOTIFICATION_CATEGORY_KEY_FILTER_DELIMITER_REGEX = /[\s,，;；|]+/u

export function splitMessageNotificationCategoryKeysFilter(
  value?: string | string[] | null,
) {
  if (value === undefined || value === null) {
    return []
  }

  const values = Array.isArray(value) ? value : [value]

  return values.flatMap((item) =>
    item
      .split(MESSAGE_NOTIFICATION_CATEGORY_KEY_FILTER_DELIMITER_REGEX)
      .map((segment) => segment.trim())
      .filter(Boolean),
  )
}

export function serializeMessageNotificationCategoryKeysFilter(
  value?: string | string[] | null,
) {
  const normalized = splitMessageNotificationCategoryKeysFilter(value)
  return normalized.length > 0 ? normalized.join(',') : undefined
}

export function isValidMessageNotificationCategoryKeysFilter(
  value?: string | string[] | null,
) {
  const normalized = splitMessageNotificationCategoryKeysFilter(value)

  return normalized.every(isMessageNotificationCategoryKey)
}

export function normalizeMessageNotificationCategoryKeysFilter(
  value?: string | string[] | null,
): MessageNotificationCategoryKey[] | undefined {
  const normalized = [
    ...new Set(
      splitMessageNotificationCategoryKeysFilter(value).filter(
        isMessageNotificationCategoryKey,
      ),
    ),
  ]

  return normalized.length > 0 ? normalized : undefined
}
