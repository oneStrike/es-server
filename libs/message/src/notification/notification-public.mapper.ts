import type { AppUserSelect, UserNotificationSelect } from '@db/schema'
import type { UserNotificationDataDto } from './dto/notification.dto'
import { isMessageNotificationCategoryKey } from './notification.constant'

export type NotificationActorSource = Pick<
  AppUserSelect,
  'id' | 'nickname' | 'avatarUrl'
>

function isPlainRecord<T>(
  value: T,
): value is Extract<T, Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function mapNotificationActor(actor?: NotificationActorSource | null) {
  if (!actor) {
    return undefined
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
    readAt: notification.readAt ?? undefined,
    expiresAt: notification.expiresAt ?? undefined,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  }
}
