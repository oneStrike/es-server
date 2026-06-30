import type {
  MessageDomainEventDefinition,
  MessageDomainEventKey,
} from './message-event.type'
import { DomainEventConsumerEnum } from '@libs/platform/modules/eventing/eventing.constant'

export const MESSAGE_DOMAIN_EVENT_DEFINITIONS = [
  {
    eventKey: 'comment.replied',
    label: '评论回复',
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
    label: '评论提及',
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
    label: '评论点赞',
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
    label: '内容点赞',
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
    label: '内容收藏',
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
    label: '内容评论',
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
    label: '内容提及',
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
    label: '用户关注',
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
    label: '公告发布',
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
    label: '公告撤回',
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
    label: '任务自动派单提醒',
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
    label: '任务即将到期提醒',
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
    label: '任务奖励到账提醒',
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
    label: '聊天消息',
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

export function getMessageDomainEventLabel(
  eventKey: string | null | undefined,
) {
  if (!eventKey) {
    return ''
  }
  return (
    MESSAGE_DOMAIN_EVENT_DEFINITION_MAP.get(eventKey as MessageDomainEventKey)
      ?.label ?? eventKey
  )
}
