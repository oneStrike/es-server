import type { UserNotificationSelect } from '@db/schema'
import type { MessageNotificationCategoryKey } from './notification.constant'
import {
  getMessageNotificationCategoryLabel,
  isMessageNotificationCategoryKey,
} from './notification.constant'

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

export interface UserNotificationPublicView {
  id: number
  receiverUserId: number
  categoryKey: MessageNotificationCategoryKey
  categoryLabel: string
  actorUserId?: number
  title: string
  content: string
  payload: Record<string, unknown> | null
  isRead: boolean
  readAt?: Date | null
  expiresAt?: Date | null
  createdAt: Date
  updatedAt: Date
  actorUser?: NotificationPublicActor
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
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
): UserNotificationPublicView {
  const rawCategoryKey = notification.categoryKey
  const categoryKey = rawCategoryKey as MessageNotificationCategoryKey
  const categoryLabel = isMessageNotificationCategoryKey(rawCategoryKey)
    ? getMessageNotificationCategoryLabel(categoryKey)
    : rawCategoryKey

  return {
    id: notification.id,
    receiverUserId: notification.receiverUserId,
    categoryKey,
    categoryLabel,
    actorUserId: notification.actorUserId ?? undefined,
    title: notification.title,
    content: notification.content,
    payload: isPlainRecord(notification.payload) ? notification.payload : null,
    isRead: notification.isRead,
    readAt: notification.readAt,
    expiresAt: notification.expiresAt,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
    actorUser: mapNotificationActor(actor),
  }
}
