import type {
  NotificationPreferenceSelect,
  UserNotificationSelect,
} from '@db/schema'
import type {
  MessageNotificationCategoryKey,
  MessageNotificationDispatchStatusEnum,
  MessageNotificationPreferenceSourceEnum,
} from './notification.constant'

export interface EffectiveMessageNotificationPreference {
  categoryKey: MessageNotificationCategoryKey
  categoryLabel: string
  isEnabled: boolean
  defaultEnabled: boolean
  source: MessageNotificationPreferenceSourceEnum
  preferenceId?: number
  updatedAt?: Date
}

export interface CreateNotificationFromOutboxResult {
  status: MessageNotificationDispatchStatusEnum
  notification?: UserNotificationSelect
  preference?: EffectiveMessageNotificationPreference
}

export type NotificationPreferenceSnapshot = Pick<
  NotificationPreferenceSelect,
  'id' | 'categoryKey' | 'isEnabled' | 'updatedAt'
>
