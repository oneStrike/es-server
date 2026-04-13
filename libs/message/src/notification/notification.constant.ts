/**
 * 通知偏好来源。
 */
export enum MessageNotificationPreferenceSourceEnum {
  DEFAULT = 'default',
  EXPLICIT = 'explicit',
}

/**
 * 通知分类键。
 * 新通知系统统一按 categoryKey 管理偏好、模板和投影视图。
 */
export const MESSAGE_NOTIFICATION_CATEGORY_KEYS = [
  'comment_reply',
  'comment_mention',
  'comment_like',
  'topic_like',
  'topic_favorited',
  'topic_commented',
  'topic_mentioned',
  'user_followed',
  'system_announcement',
  'task_reminder',
] as const

export type MessageNotificationCategoryKey =
  (typeof MESSAGE_NOTIFICATION_CATEGORY_KEYS)[number]

export const MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM = {
  COMMENT_REPLY: 'comment_reply',
  COMMENT_MENTION: 'comment_mention',
  COMMENT_LIKE: 'comment_like',
  TOPIC_LIKE: 'topic_like',
  TOPIC_FAVORITED: 'topic_favorited',
  TOPIC_COMMENTED: 'topic_commented',
  TOPIC_MENTIONED: 'topic_mentioned',
  USER_FOLLOWED: 'user_followed',
  SYSTEM_ANNOUNCEMENT: 'system_announcement',
  TASK_REMINDER: 'task_reminder',
} as const satisfies Record<string, MessageNotificationCategoryKey>

export function isMessageNotificationCategoryKey(
  value: string,
): value is MessageNotificationCategoryKey {
  return (MESSAGE_NOTIFICATION_CATEGORY_KEYS as readonly string[]).includes(value)
}

const MESSAGE_NOTIFICATION_CATEGORY_LABEL_MAP: Record<
  MessageNotificationCategoryKey,
  string
> = {
  comment_reply: '评论回复',
  comment_mention: '评论提及',
  comment_like: '评论点赞',
  topic_like: '主题点赞',
  topic_favorited: '主题收藏',
  topic_commented: '主题评论',
  topic_mentioned: '主题提及',
  user_followed: '用户关注',
  system_announcement: '系统公告',
  task_reminder: '任务提醒',
}

export function getMessageNotificationCategoryLabel(
  categoryKey: MessageNotificationCategoryKey,
) {
  return MESSAGE_NOTIFICATION_CATEGORY_LABEL_MAP[categoryKey]
}

/**
 * 通知投影处理状态。
 */
export enum MessageNotificationDispatchStatusEnum {
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  SKIPPED_PREFERENCE = 'SKIPPED_PREFERENCE',
}

const MESSAGE_NOTIFICATION_DISPATCH_STATUS_LABEL_MAP: Record<
  MessageNotificationDispatchStatusEnum,
  string
> = {
  [MessageNotificationDispatchStatusEnum.DELIVERED]: '已投递',
  [MessageNotificationDispatchStatusEnum.FAILED]: '投递失败',
  [MessageNotificationDispatchStatusEnum.RETRYING]: '重试中',
  [MessageNotificationDispatchStatusEnum.SKIPPED_PREFERENCE]: '偏好关闭跳过',
}

export function getMessageNotificationDispatchStatusLabel(
  status: MessageNotificationDispatchStatusEnum,
) {
  return MESSAGE_NOTIFICATION_DISPATCH_STATUS_LABEL_MAP[status]
}
