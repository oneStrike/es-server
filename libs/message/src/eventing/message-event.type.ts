import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing'
import type {
  MessageDomainEventDefinition,
  MessageDomainEventKey,
} from './message-event.constant'
import type { MessageNotificationCategoryKey } from '../notification/notification.constant'

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

export interface NotificationProjectionCommandBase {
  receiverUserId: number
  projectionKey: string
}

export type NotificationProjectionCommand =
  | (NotificationProjectionCommandBase & {
      mode: 'append' | 'upsert'
      categoryKey: MessageNotificationCategoryKey
      mandatory: boolean
      title: string
      content: string
      actorUserId?: number
      payload?: Record<string, unknown>
      expiresAt?: Date
    })
  | (NotificationProjectionCommandBase & {
      mode: 'delete'
    })
  | {
      mode: 'skip'
      reason: string
    }

export interface NotificationProjectionApplyResult {
  action: 'append' | 'upsert' | 'delete' | 'skip'
  receiverUserId?: number
  projectionKey?: string
  notification?: Record<string, unknown>
  reason?: string
  templateId?: number
  usedTemplate?: boolean
  fallbackReason?: string
}

export interface NotificationEventHandlerContext {
  definition: MessageDomainEventDefinition
  event: DomainEventRecord
  dispatch: DomainEventDispatchRecord
}

export type NotificationEventHandler = (
  context: NotificationEventHandlerContext,
) => Promise<NotificationProjectionCommand> | NotificationProjectionCommand
