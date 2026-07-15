import type {
  MessageConsumerEventKey,
  MessageConsumerEventMetadata,
} from './message-consumer-event.type'

export const MESSAGE_CONSUMER_EVENT_METADATA = [
  {
    eventKey: 'comment.replied',
    label: '评论回复',
    notification: {
      categoryKey: 'comment_reply',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'comment.mentioned',
    label: '评论提及',
    notification: {
      categoryKey: 'comment_mention',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'comment.liked',
    label: '评论点赞',
    notification: {
      categoryKey: 'comment_like',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'topic.liked',
    label: '内容点赞',
    notification: {
      categoryKey: 'topic_like',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'topic.favorited',
    label: '内容收藏',
    notification: {
      categoryKey: 'topic_favorited',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'topic.commented',
    label: '内容评论',
    notification: {
      categoryKey: 'topic_commented',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'topic.mentioned',
    label: '内容提及',
    notification: {
      categoryKey: 'topic_mentioned',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'user.followed',
    label: '用户关注',
    notification: {
      categoryKey: 'user_followed',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'announcement.published',
    label: '公告发布',
    notification: {
      categoryKey: 'system_announcement',
      mandatory: true,
      projectionMode: 'upsert',
    },
  },
  {
    eventKey: 'announcement.unpublished',
    label: '公告撤回',
    notification: {
      categoryKey: 'system_announcement',
      mandatory: true,
      projectionMode: 'delete',
    },
  },
  {
    eventKey: 'task.reminder.auto_assigned',
    label: '任务自动派单提醒',
    notification: {
      categoryKey: 'task_reminder',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'task.reminder.expiring',
    label: '任务即将到期提醒',
    notification: {
      categoryKey: 'task_reminder',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'task.reminder.reward_granted',
    label: '任务奖励到账提醒',
    notification: {
      categoryKey: 'task_reminder',
      mandatory: false,
      projectionMode: 'append',
    },
  },
  {
    eventKey: 'chat.message.created',
    label: '聊天消息',
  },
] as const satisfies readonly MessageConsumerEventMetadata[]

export const MESSAGE_CONSUMER_EVENT_METADATA_MAP = new Map(
  MESSAGE_CONSUMER_EVENT_METADATA.map(
    (metadata) => [metadata.eventKey, metadata] as const,
  ),
)

export function getMessageConsumerEventMetadata(
  eventKey: MessageConsumerEventKey,
) {
  const metadata = MESSAGE_CONSUMER_EVENT_METADATA_MAP.get(eventKey)
  if (!metadata) {
    throw new Error(`Unsupported message consumer event metadata: ${eventKey}`)
  }
  return metadata
}

export function getMessageConsumerEventLabel(
  eventKey: string | null | undefined,
) {
  if (!eventKey) {
    return ''
  }
  return (
    MESSAGE_CONSUMER_EVENT_METADATA_MAP.get(eventKey as MessageConsumerEventKey)
      ?.label ?? eventKey
  )
}
