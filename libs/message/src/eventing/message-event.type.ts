import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing'
import type { NotificationUserSnapshot } from '../notification/notification-contract.type'
import type { MessageNotificationCategoryKey } from '../notification/notification.constant'
import type {
  MessageDomainEventDefinition,
  MessageDomainEventKey,
} from './message-event.constant'

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
