import type { MessageNotificationCategoryKey } from '../notification/notification.constant'
import { DomainEventConsumerEnum } from '@libs/platform/modules/eventing/eventing.constant'

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

export type MessageNotificationProjectionMode =
  | 'append'
  | 'upsert'
  | 'delete'
  | 'none'

export interface MessageDomainEventDefinition {
  eventKey: MessageDomainEventKey
  domain: 'message'
  consumers: DomainEventConsumerEnum[]
  notification?: {
    categoryKey: MessageNotificationCategoryKey
    mandatory: boolean
    projectionMode: MessageNotificationProjectionMode
  }
}

export const MESSAGE_DOMAIN_EVENT_DEFINITIONS = [
  {
    eventKey: 'comment.replied',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'comment_reply',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'comment.mentioned',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'comment_mention',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'comment.liked',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'comment_like',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'topic.liked',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'topic_like',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'topic.favorited',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'topic_favorited',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'topic.commented',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'topic_commented',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'topic.mentioned',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'topic_mentioned',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'user.followed',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'user_followed',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'announcement.published',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'system_announcement',
      mandatory: true,
      projectionMode: 'upsert',
    },
  },
  {
    eventKey: 'announcement.unpublished',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'system_announcement',
      mandatory: true,
      projectionMode: 'delete',
    },
  },
  {
    eventKey: 'task.reminder.auto_assigned',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'task_reminder',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'task.reminder.expiring',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'task_reminder',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'task.reminder.reward_granted',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.NOTIFICATION],
    notification: {
      categoryKey: 'task_reminder',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'chat.message.created',
    domain: 'message',
    consumers: [DomainEventConsumerEnum.CHAT_REALTIME],
  },
] as const satisfies readonly MessageDomainEventDefinition[]

export const MESSAGE_DOMAIN_EVENT_DEFINITION_MAP = new Map(
  MESSAGE_DOMAIN_EVENT_DEFINITIONS.map(
    (definition) => [definition.eventKey, definition] as const,
  ),
)

export function getMessageDomainEventDefinition(
  eventKey: MessageDomainEventKey,
) {
  const definition = MESSAGE_DOMAIN_EVENT_DEFINITION_MAP.get(eventKey)
  if (!definition) {
    throw new Error(`Unsupported message domain event: ${eventKey}`)
  }
  return definition
}
