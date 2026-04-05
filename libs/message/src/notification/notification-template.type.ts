import type { NotificationOutboxPayload } from '../outbox/outbox.type'
import type { MessageNotificationTypeEnum } from './notification.constant'

/**
 * 通知模板渲染上下文
 * 模板仅消费当前通知事件的最小字段，不承担接收人选择或幂等判定
 */
export interface NotificationTemplateRenderContext {
  notificationType: MessageNotificationTypeEnum
  templateKey: string
  receiverUserId: number
  actorUserId?: number
  targetType?: number
  targetId?: number
  subjectType?: number
  subjectId?: number
  aggregateKey?: string
  aggregateCount?: number
  expiredAt?: Date | string
  payload?: unknown
}

/**
 * 通知模板回退原因
 * 仅用于调试和可观测性，不改变通知主链路成功语义
 */
export type NotificationTemplateFallbackReason
  = 'missing_or_disabled'
    | 'render_failed'

/**
 * 通知模板渲染结果
 * 即使模板缺失或渲染异常，也必须回退到业务方提供的 fallback 文案
 */
export interface NotificationTemplateRenderResult {
  title: string
  content: string
  templateKey: string
  templateId?: number
  usedTemplate: boolean
  fallbackReason?: NotificationTemplateFallbackReason
}

/**
 * 通知模板渲染入参
 * 复用 outbox payload 作为 fallback 文案来源，再叠加当前通知类型
 */
export type RenderNotificationTemplateInput = Pick<
  NotificationOutboxPayload,
  | 'receiverUserId'
  | 'actorUserId'
  | 'type'
  | 'targetType'
  | 'targetId'
  | 'subjectType'
  | 'subjectId'
  | 'title'
  | 'content'
  | 'payload'
  | 'aggregateKey'
  | 'aggregateCount'
  | 'expiredAt'
>
