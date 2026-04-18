import type { UserNotificationSelect } from '@db/schema'
import type { UserNotificationDto } from './dto/notification.dto'
import type {
  MessageNotificationData,
  MessageNotificationPublicView,
} from './notification-contract.type'
import { isMessageNotificationCategoryKey } from './notification.constant'

export interface NotificationPublicActor {
  id: number
  nickname?: string
  avatarUrl?: string
}

export interface NotificationActorSource {
  id: number
  nickname?: string | null
  avatarUrl?: string | null
}

function isPlainRecord<T>(
  value: T,
): value is Extract<T, Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function mapNotificationActor(
  actor?: NotificationActorSource | null,
): NotificationPublicActor | undefined {
  if (!actor) {
    return undefined
  }

  const mapped: NotificationPublicActor = {
    id: actor.id,
  }

  if (typeof actor.nickname === 'string' && actor.nickname.trim()) {
    mapped.nickname = actor.nickname
  }

  if (typeof actor.avatarUrl === 'string' && actor.avatarUrl.trim()) {
    mapped.avatarUrl = actor.avatarUrl
  }

  return mapped
}

export function mapUserNotificationToPublicView(
  notification: UserNotificationSelect,
  actor?: NotificationActorSource | null,
): UserNotificationDto {
  const rawCategoryKey = notification.categoryKey
  if (!isMessageNotificationCategoryKey(rawCategoryKey)) {
    throw new TypeError(
      `Unsupported notification category key: ${rawCategoryKey}`,
    )
  }

  const mapped: MessageNotificationPublicView = {
    id: notification.id,
    type: rawCategoryKey,
    actor: mapNotificationActor(actor),
    message: {
      title: notification.title,
      body: notification.content,
    },
    data: (isPlainRecord(notification.payload)
      ? notification.payload
      : notification.payload === null
        ? null
        : null) as MessageNotificationData | null,
    isRead: notification.isRead,
    readAt: notification.readAt ?? undefined,
    expiresAt: notification.expiresAt ?? undefined,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  }

  return mapped
}
