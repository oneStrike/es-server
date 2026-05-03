import type { StructuredValue } from '@libs/platform/utils'
import type { NotificationUserSnapshot } from './notification-contract.type'
import type { MessageNotificationCategoryKey } from './notification.constant'

/** 通知模板渲染上下文中允许被占位符读取的值类型。 */
export type NotificationTemplateContextValue =
  | object
  | string
  | number
  | boolean
  | Date
  | undefined
  | null

/** 稳定领域类型 `NotificationTemplateRenderContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface NotificationTemplateRenderContext {
  categoryKey: MessageNotificationCategoryKey
  receiverUserId: number
  actorUserId?: number
  actor?: NotificationUserSnapshot
  title: string
  content: string
  expiresAt?: Date | string
  data?: StructuredValue | null
}

/** 稳定领域类型 `NotificationTemplateFallbackReason`。仅供内部领域/服务链路复用，避免重复定义。 */
export type NotificationTemplateFallbackReason =
  | 'missing_or_disabled'
  | 'render_failed'

/** 稳定领域类型 `NotificationTemplateRenderResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface NotificationTemplateRenderResult {
  title: string
  content: string
  categoryKey: MessageNotificationCategoryKey
  actor?: NotificationUserSnapshot
  templateId?: number
  usedTemplate: boolean
  fallbackReason?: NotificationTemplateFallbackReason
}

/** 稳定领域类型 `RenderNotificationTemplateInput`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface RenderNotificationTemplateInput {
  categoryKey: MessageNotificationCategoryKey
  receiverUserId: number
  actorUserId?: number
  title: string
  content: string
  data?: StructuredValue
  expiresAt?: Date | string
}
