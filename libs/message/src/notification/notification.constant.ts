/**
 * 消息通知类型枚举
 * 统一使用 SmallInt 存储
 * 既有 1~7 编码已冻结，新增类型只允许按追加方式扩展
 */
export enum MessageNotificationTypeEnum {
  /** 评论回复通知 */
  COMMENT_REPLY = 1,
  /** 评论点赞通知 */
  COMMENT_LIKE = 2,
  /** 内容收藏通知 */
  CONTENT_FAVORITE = 3,
  /** 用户关注通知 */
  USER_FOLLOW = 4,
  /** 系统公告通知 */
  SYSTEM_ANNOUNCEMENT = 5,
  /** 聊天消息通知 */
  CHAT_MESSAGE = 6,
  /** 任务提醒通知 */
  TASK_REMINDER = 7,
  /** 主题点赞通知 */
  TOPIC_LIKE = 8,
  /** 主题收藏通知 */
  TOPIC_FAVORITE = 9,
  /** 主题评论通知 */
  TOPIC_COMMENT = 10,
}

/**
 * 通知模板定义
 * 统一维护通知类型、稳定模板键与默认模板文案，供模板表、渲染服务和 seed 复用
 */
export interface MessageNotificationTemplateDefinition {
  /** 通知类型编码 */
  notificationType: MessageNotificationTypeEnum
  /** 稳定模板键 */
  templateKey: string
  /** 管理端展示名称 */
  label: string
  /** 默认偏好开关 */
  defaultPreferenceEnabled: boolean
  /** 默认标题模板 */
  defaultTitleTemplate: string
  /** 默认正文模板 */
  defaultContentTemplate: string
}

/**
 * 站内通知模板定义表
 * 当前按通知类型一对一配置，后续若扩展渠道也不在本阶段复用此结构
 */
export const MESSAGE_NOTIFICATION_TEMPLATE_DEFINITIONS: readonly MessageNotificationTemplateDefinition[] = [
  {
    notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
    templateKey: 'notification.comment-reply',
    label: '评论回复通知',
    defaultPreferenceEnabled: true,
    defaultTitleTemplate: '{{payload.actorNickname}} 回复了你的评论',
    defaultContentTemplate: '{{payload.replyExcerpt}}',
  },
  {
    notificationType: MessageNotificationTypeEnum.COMMENT_LIKE,
    templateKey: 'notification.comment-like',
    label: '评论点赞通知',
    defaultPreferenceEnabled: true,
    defaultTitleTemplate: '你的评论收到点赞',
    defaultContentTemplate: '有人点赞了你的评论',
  },
  {
    notificationType: MessageNotificationTypeEnum.CONTENT_FAVORITE,
    templateKey: 'notification.content-favorite',
    label: '内容收藏通知',
    defaultPreferenceEnabled: true,
    defaultTitleTemplate: '你的内容被收藏了',
    defaultContentTemplate: '有人收藏了你的内容',
  },
  {
    notificationType: MessageNotificationTypeEnum.USER_FOLLOW,
    templateKey: 'notification.user-follow',
    label: '关注通知',
    defaultPreferenceEnabled: true,
    defaultTitleTemplate: '你有新的关注',
    defaultContentTemplate: '有人关注了你',
  },
  {
    notificationType: MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT,
    templateKey: 'notification.system-announcement',
    label: '系统公告通知',
    defaultPreferenceEnabled: true,
    defaultTitleTemplate: '{{payload.title}}',
    defaultContentTemplate: '{{payload.content}}',
  },
  {
    notificationType: MessageNotificationTypeEnum.CHAT_MESSAGE,
    templateKey: 'notification.chat-message',
    label: '聊天消息通知',
    defaultPreferenceEnabled: true,
    defaultTitleTemplate: '新聊天消息',
    defaultContentTemplate: '你收到一条新的聊天消息',
  },
  {
    notificationType: MessageNotificationTypeEnum.TASK_REMINDER,
    templateKey: 'notification.task-reminder',
    label: '任务提醒',
    defaultPreferenceEnabled: true,
    defaultTitleTemplate: '{{payload.title}}',
    defaultContentTemplate: '{{payload.content}}',
  },
  {
    notificationType: MessageNotificationTypeEnum.TOPIC_LIKE,
    templateKey: 'notification.topic-like',
    label: '主题点赞通知',
    defaultPreferenceEnabled: true,
    defaultTitleTemplate: '{{payload.actorNickname}} 点赞了你的主题',
    defaultContentTemplate: '{{payload.topicTitle}}',
  },
  {
    notificationType: MessageNotificationTypeEnum.TOPIC_FAVORITE,
    templateKey: 'notification.topic-favorite',
    label: '主题收藏通知',
    defaultPreferenceEnabled: true,
    defaultTitleTemplate: '{{payload.actorNickname}} 收藏了你的主题',
    defaultContentTemplate: '{{payload.topicTitle}}',
  },
  {
    notificationType: MessageNotificationTypeEnum.TOPIC_COMMENT,
    templateKey: 'notification.topic-comment',
    label: '主题评论通知',
    defaultPreferenceEnabled: true,
    defaultTitleTemplate: '{{payload.actorNickname}} 评论了你的主题',
    defaultContentTemplate: '{{payload.commentExcerpt}}',
  },
] as const

/** 站内通知类型值列表 */
export const MESSAGE_NOTIFICATION_TYPE_VALUES = MESSAGE_NOTIFICATION_TEMPLATE_DEFINITIONS.map(
  (item) => item.notificationType,
)

/** 通知类型到模板定义的稳定映射 */
export const MESSAGE_NOTIFICATION_TEMPLATE_DEFINITION_MAP = new Map(
  MESSAGE_NOTIFICATION_TEMPLATE_DEFINITIONS.map((item) => [
    item.notificationType,
    item,
  ] as const),
)

/**
 * 获取通知模板定义
 * 未注册的通知类型会抛错，避免出现漂移映射
 */
export function getMessageNotificationTemplateDefinition(
  notificationType: MessageNotificationTypeEnum,
) {
  const definition
    = MESSAGE_NOTIFICATION_TEMPLATE_DEFINITION_MAP.get(notificationType)
  if (!definition) {
    throw new Error(`Unsupported notification type: ${notificationType}`)
  }
  return definition
}

/** 获取通知类型对应的稳定模板键 */
export function getMessageNotificationTemplateKey(
  notificationType: MessageNotificationTypeEnum,
) {
  return getMessageNotificationTemplateDefinition(notificationType).templateKey
}

/** 获取通知类型对应的中文标签 */
export function getMessageNotificationTypeLabel(
  notificationType: MessageNotificationTypeEnum,
) {
  return getMessageNotificationTemplateDefinition(notificationType).label
}

/** 获取通知类型默认是否启用 */
export function getMessageNotificationDefaultPreferenceEnabled(
  notificationType: MessageNotificationTypeEnum,
) {
  return getMessageNotificationTemplateDefinition(
    notificationType,
  ).defaultPreferenceEnabled
}

/**
 * 通知偏好来源枚举
 * default 表示使用系统默认策略，explicit 表示存在用户显式覆盖配置
 */
export enum MessageNotificationPreferenceSourceEnum {
  DEFAULT = 'default',
  EXPLICIT = 'explicit',
}

/**
 * 站内通知投递结果状态
 * 当前先由通知主链路给出最小业务结果，供后续 delivery 表直接复用
 */
export enum MessageNotificationDispatchStatusEnum {
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  SKIPPED_DUPLICATE = 'SKIPPED_DUPLICATE',
  SKIPPED_SELF = 'SKIPPED_SELF',
  SKIPPED_PREFERENCE = 'SKIPPED_PREFERENCE',
}

const MESSAGE_NOTIFICATION_DISPATCH_STATUS_LABEL_MAP: Record<
  MessageNotificationDispatchStatusEnum,
  string
> = {
  [MessageNotificationDispatchStatusEnum.DELIVERED]: '已投递',
  [MessageNotificationDispatchStatusEnum.FAILED]: '投递失败',
  [MessageNotificationDispatchStatusEnum.RETRYING]: '重试中',
  [MessageNotificationDispatchStatusEnum.SKIPPED_DUPLICATE]: '幂等跳过',
  [MessageNotificationDispatchStatusEnum.SKIPPED_SELF]: '自通知跳过',
  [MessageNotificationDispatchStatusEnum.SKIPPED_PREFERENCE]: '偏好关闭跳过',
}

/** 获取通知业务投递结果中文标签 */
export function getMessageNotificationDispatchStatusLabel(
  status: MessageNotificationDispatchStatusEnum,
) {
  return MESSAGE_NOTIFICATION_DISPATCH_STATUS_LABEL_MAP[status]
}

/**
 * 通知主体类型枚举
 * 统一使用 SmallInt 存储
 */
export enum MessageNotificationSubjectTypeEnum {
  /** 评论 */
  COMMENT = 1,
  /** 作品 */
  WORK = 2,
  /** 用户 */
  USER = 3,
  /** 系统 */
  SYSTEM = 4,
}
