import type {
  NotificationPreferenceSelect,
  UserNotificationSelect,
} from '@db/schema'
import type {
  MessageNotificationDispatchStatusEnum,
  MessageNotificationPreferenceSourceEnum,
  MessageNotificationTypeEnum,
} from './notification.constant'

/**
 * 有效通知偏好视图
 * 将默认策略与显式覆盖合并后的结果，供 App 端展示和通知主链路判断复用
 */
export interface EffectiveMessageNotificationPreference {
  notificationType: MessageNotificationTypeEnum
  notificationTypeLabel: string
  isEnabled: boolean
  defaultEnabled: boolean
  source: MessageNotificationPreferenceSourceEnum
  preferenceId?: number
  updatedAt?: Date
}

/**
 * 通知创建结果
 * 先表达最小业务投递结果，后续 delivery 表可直接复用这些状态写入事实表
 */
export interface CreateNotificationFromOutboxResult {
  status: MessageNotificationDispatchStatusEnum
  notification?: UserNotificationSelect
  preference?: EffectiveMessageNotificationPreference
}

/**
 * 通知偏好实体快照
 * 用于服务内部从数据库记录映射到有效偏好视图，避免直接耦合 Drizzle 行对象
 */
export type NotificationPreferenceSnapshot = Pick<
  NotificationPreferenceSelect,
  'id' | 'notificationType' | 'isEnabled' | 'updatedAt'
>
