import type { MessageNotificationCategoryKey } from './notification.constant'

export interface NotificationTemplateRenderContext {
  categoryKey: MessageNotificationCategoryKey
  receiverUserId: number
  actorUserId?: number
  expiresAt?: Date | string
  payload?: unknown
}

export type NotificationTemplateFallbackReason
  = 'missing_or_disabled'
    | 'render_failed'

export interface NotificationTemplateRenderResult {
  title: string
  content: string
  categoryKey: MessageNotificationCategoryKey
  templateId?: number
  usedTemplate: boolean
  fallbackReason?: NotificationTemplateFallbackReason
}

export interface RenderNotificationTemplateInput {
  categoryKey: MessageNotificationCategoryKey
  receiverUserId: number
  actorUserId?: number
  title: string
  content: string
  payload?: unknown
  expiresAt?: Date | string
}
