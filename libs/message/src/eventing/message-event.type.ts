import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing/domain-event.type'
import type { DomainEventConsumerEnum } from '@libs/platform/modules/eventing/eventing.constant'
import type { NotificationUserSnapshot } from '../notification/notification-contract.type'
import type { MessageNotificationCategoryKey } from '../notification/notification.type'

/** 消息域领域事件键。 */
export type MessageDomainEventKey =
  | 'comment.replied'
  | 'comment.mentioned'
  | 'comment.liked'
  | 'topic.liked'
  | 'topic.favorited'
  | 'topic.commented'
  | 'topic.mentioned'
  | 'user.followed'
  | 'announcement.published'
  | 'announcement.unpublished'
  | 'task.reminder.auto_assigned'
  | 'task.reminder.expiring'
  | 'task.reminder.reward_granted'
  | 'chat.message.created'

/** 消息通知投影模式。 */
export type MessageNotificationProjectionMode =
  'append' | 'upsert' | 'delete' | 'none'

/** 消息域事件定义，用于声明消费者和可选通知投影配置。 */
export interface MessageDomainEventDefinition {
  eventKey: MessageDomainEventKey
  label: string
  domain: 'message'
  consumers: DomainEventConsumerEnum[]
  notification?: {
    categoryKey: MessageNotificationCategoryKey
    mandatory: boolean
    projectionMode: MessageNotificationProjectionMode
  }
}

/** 稳定领域类型 `PublishMessageDomainEventInput`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface PublishMessageDomainEventInput {
  eventKey: MessageDomainEventKey
  idempotencyKey?: string
  subjectType: string
  subjectId: number
  targetType: string
  targetId: number
  operatorId?: number
  occurredAt?: Date
  context?: Record<string, unknown>
}

/** 稳定领域类型 `NotificationProjectionCommandBase`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface NotificationProjectionCommandBase {
  receiverUserId: number
  projectionKey: string
}

/** 稳定领域类型 `NotificationProjectionCommand`。仅供内部领域/服务链路复用，避免重复定义。 */
export type NotificationProjectionCommand =
  | (NotificationProjectionCommandBase & {
      mode: 'append' | 'upsert'
      categoryKey: MessageNotificationCategoryKey
      mandatory: boolean
      title: string
      content: string
      actorUserId?: number
      payload?: Record<string, unknown> | null
      expiresAt?: Date
    })
    | (NotificationProjectionCommandBase & {
      announcementId?: number
      categoryKey?: MessageNotificationCategoryKey
      mode: 'delete'
    })
    | {
      mode: 'skip'
      reason: string
    }

/** 稳定领域类型 `NotificationProjectionApplyResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface NotificationProjectionApplyResult {
  action: 'append' | 'upsert' | 'delete' | 'skip'
  receiverUserId?: number
  projectionKey?: string
  notification?: Record<string, unknown>
  actor?: NotificationUserSnapshot
  reason?: string
  templateId?: number
  usedTemplate?: boolean
  fallbackReason?: string
}

/** 稳定领域类型 `NotificationEventHandlerContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface NotificationEventHandlerContext {
  definition: MessageDomainEventDefinition
  event: DomainEventRecord
  dispatch: DomainEventDispatchRecord
}

/** 稳定领域类型 `NotificationEventHandler`。仅供内部领域/服务链路复用，避免重复定义。 */
export type NotificationEventHandler = (
  context: NotificationEventHandlerContext,
) => Promise<NotificationProjectionCommand> | NotificationProjectionCommand
