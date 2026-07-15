import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/eventing/eventing/domain-event.type'
import type { NotificationUserSnapshot } from '../notification/notification-contract.type'
import type { MessageNotificationCategoryKey } from '../notification/notification.type'

/** 由 message consumer 展示或投影的事件键。 */
export type MessageConsumerEventKey =
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

/** message consumer 所有的事件标签与可选通知投影配置。 */
export interface MessageConsumerEventMetadata {
  eventKey: MessageConsumerEventKey
  label: string
  notification?: {
    categoryKey: MessageNotificationCategoryKey
    mandatory: boolean
    projectionMode: MessageNotificationProjectionMode
  }
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
  metadata: MessageConsumerEventMetadata
  event: DomainEventRecord
  dispatch: DomainEventDispatchRecord
}

/** 稳定领域类型 `NotificationEventHandler`。仅供内部领域/服务链路复用，避免重复定义。 */
export type NotificationEventHandler = (
  context: NotificationEventHandlerContext,
) => Promise<NotificationProjectionCommand> | NotificationProjectionCommand
