import type {
  NotificationPreferenceSelect,
  UserNotificationSelect,
} from '@db/schema'

import type {
  MessageNotificationCategoryKey,
  MessageNotificationDispatchStatusEnum,
  MessageNotificationPreferenceSourceEnum,
} from './notification.constant'

/** 稳定领域类型 `EffectiveMessageNotificationPreference`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface EffectiveMessageNotificationPreference {
  categoryKey: MessageNotificationCategoryKey
  categoryLabel: string
  isEnabled: boolean
  defaultEnabled: boolean
  source: MessageNotificationPreferenceSourceEnum
  updatedAt?: Date
}

/** 稳定领域类型 `CreateNotificationFromOutboxResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface CreateNotificationFromOutboxResult {
  status: MessageNotificationDispatchStatusEnum
  notification?: UserNotificationSelect
  preference?: EffectiveMessageNotificationPreference
}

/** 稳定领域类型 `NotificationPreferenceSnapshot`。仅供内部领域/服务链路复用，避免重复定义。 */
export type NotificationPreferenceSnapshot = Pick<
  NotificationPreferenceSelect,
  'id' | 'categoryKey' | 'isEnabled' | 'updatedAt'
>
