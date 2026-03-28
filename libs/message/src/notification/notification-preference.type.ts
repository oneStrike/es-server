import type {
  NotificationPreference,
  UserNotification,
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
 * 单条通知偏好更新入参
 * 只允许按通知类型调整启用状态，不引入模板键或事件 code 维度
 */
export interface UpdateMessageNotificationPreferenceItemInput {
  notificationType: MessageNotificationTypeEnum
  isEnabled: boolean
}

/**
 * 批量更新通知偏好入参
 * 用于 App 端一次提交多项覆盖配置，减少多次往返
 */
export interface UpdateMessageNotificationPreferencesInput {
  preferences: UpdateMessageNotificationPreferenceItemInput[]
}

/**
 * 通知创建结果
 * 先表达最小业务投递结果，后续 delivery 表可直接复用这些状态写入事实表
 */
export interface CreateNotificationFromOutboxResult {
  status: MessageNotificationDispatchStatusEnum
  notification?: UserNotification
  preference?: EffectiveMessageNotificationPreference
}

/**
 * 通知偏好实体快照
 * 用于服务内部从数据库记录映射到有效偏好视图，避免直接耦合 Drizzle 行对象
 */
export type NotificationPreferenceSnapshot = Pick<
  NotificationPreference,
  'id' | 'notificationType' | 'isEnabled' | 'updatedAt'
>
