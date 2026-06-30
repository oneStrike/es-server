import type { UserNotificationSelect } from '@db/schema'
import type { NotificationActorSource } from './notification-public.type'
import type { UserNotificationDataDto } from './notification.type'
import { isMessageNotificationCategoryKey } from './notification.constant'

function isPlainRecord<T>(
  value: T,
): value is Extract<T, Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function mapNotificationActor(actor?: NotificationActorSource | null) {
  if (!actor) {
    return null
  }

  return {
    id: actor.id,
    avatarUrl:
      typeof actor.avatarUrl === 'string' && actor.avatarUrl.trim()
        ? actor.avatarUrl
        : null,
    nickname: actor.nickname,
  }
}

function mapNotificationData(payload: UserNotificationSelect['payload']) {
  if (isPlainRecord(payload)) {
    return payload as UserNotificationDataDto
  }

  return null
}

export function mapUserNotificationToPublicView(
  notification: UserNotificationSelect,
  actor?: NotificationActorSource | null,
) {
  const rawCategoryKey = notification.categoryKey
  if (!isMessageNotificationCategoryKey(rawCategoryKey)) {
    throw new TypeError(
      `Unsupported notification category key: ${rawCategoryKey}`,
    )
  }

  return {
    id: notification.id,
    type: rawCategoryKey,
    actor: mapNotificationActor(actor),
    message: {
      title: notification.title,
      body: notification.content,
    },
    data: mapNotificationData(notification.payload),
    isRead: notification.isRead,
    readAt: notification.readAt ?? null,
    expiresAt: notification.expiresAt ?? null,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  }
}
