import type {
  CreateNotificationOutboxEventInput,
  NotificationOutboxPayload,
} from '../outbox/outbox.type'
import type { CreateNotificationFromOutboxResult } from './notification-preference.type'
import type {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
} from './notification.constant'

/**
 * 创建通知返回结构
 * 用于区分真正投递、幂等跳过、自通知跳过和偏好抑制
 */
export type CreateNotificationFromOutboxOutput = CreateNotificationFromOutboxResult

/**
 * 通知展示快照基础字段
 * 统一字段命名，避免不同业务模块各自拼装 payload 命名
 */
export interface MessageNotificationSnapshotPayloadBase {
  actorNickname?: string
  topicTitle?: string
  commentExcerpt?: string
  replyExcerpt?: string
  targetDisplayTitle?: string
}

/**
 * 主题点赞通知展示快照
 */
export interface TopicLikeNotificationPayload
  extends Pick<
    MessageNotificationSnapshotPayloadBase,
    'actorNickname' | 'topicTitle'
  > {}

/**
 * 主题收藏通知展示快照
 */
export interface TopicFavoriteNotificationPayload
  extends Pick<
    MessageNotificationSnapshotPayloadBase,
    'actorNickname' | 'topicTitle'
  > {}

/**
 * 主题评论通知展示快照
 */
export interface TopicCommentNotificationPayload
  extends Pick<
    MessageNotificationSnapshotPayloadBase,
    'actorNickname' | 'topicTitle' | 'commentExcerpt'
  > {}

/**
 * 评论提及通知展示快照
 */
export interface CommentMentionNotificationPayload
  extends Pick<
    MessageNotificationSnapshotPayloadBase,
    'actorNickname' | 'commentExcerpt' | 'targetDisplayTitle'
  > {}

/**
 * 主题提及通知展示快照
 */
export interface TopicMentionNotificationPayload
  extends Pick<
    MessageNotificationSnapshotPayloadBase,
    'actorNickname' | 'topicTitle'
  > {}

/**
 * 评论回复通知展示快照
 */
export interface CommentReplyNotificationPayload
  extends Pick<
    MessageNotificationSnapshotPayloadBase,
    'actorNickname' | 'replyExcerpt' | 'targetDisplayTitle'
  > {}

/**
 * 统一通知事件构造入参
 * composer 负责收口 payload 与 fallback 文案，但不负责接收人选择与 bizKey 生成
 */
export interface BuildMessageNotificationEventInput<TPayload = unknown> {
  bizKey: string
  type: MessageNotificationTypeEnum
  receiverUserId: number
  actorUserId?: number
  targetType?: number
  targetId?: number
  subjectType?: MessageNotificationSubjectTypeEnum
  subjectId?: number
  title: string
  content: string
  payload?: TPayload
  aggregateKey?: string
  aggregateCount?: number
  expiredAt?: Date | string
}

/**
 * 通知 outbox 载荷的 typed 视图
 * 保持与现有 CreateNotificationOutboxEventInput 结构兼容，便于直接传给 outbox service
 */
export interface TypedNotificationOutboxPayload<TPayload = unknown>
  extends Omit<NotificationOutboxPayload, 'payload'> {
  payload?: TPayload
}

/**
 * composer 输出的通知事件
 * 与 outbox 入参结构保持一致，供业务侧直接入队
 */
export interface MessageNotificationComposedEvent<TPayload = unknown>
  extends Omit<CreateNotificationOutboxEventInput, 'payload'> {
  payload: TypedNotificationOutboxPayload<TPayload>
}

/**
 * 主题点赞通知构造入参
 */
export interface BuildTopicLikeNotificationEventInput {
  bizKey: string
  receiverUserId: number
  actorUserId: number
  targetType: number
  targetId: number
  payload: TopicLikeNotificationPayload
}

/**
 * 主题收藏通知构造入参
 */
export interface BuildTopicFavoriteNotificationEventInput {
  bizKey: string
  receiverUserId: number
  actorUserId: number
  targetType: number
  targetId: number
  payload: TopicFavoriteNotificationPayload
}

/**
 * 主题评论通知构造入参
 */
export interface BuildTopicCommentNotificationEventInput {
  bizKey: string
  receiverUserId: number
  actorUserId: number
  targetType: number
  targetId: number
  subjectId: number
  payload: TopicCommentNotificationPayload
  aggregateKey?: string
  aggregateCount?: number
  expiredAt?: Date | string
}

/**
 * 评论回复通知构造入参
 */
export interface BuildCommentReplyNotificationEventInput {
  bizKey: string
  receiverUserId: number
  actorUserId: number
  targetType: number
  targetId: number
  subjectId: number
  payload: CommentReplyNotificationPayload
  aggregateKey?: string
  aggregateCount?: number
  expiredAt?: Date | string
}

/**
 * 评论提及通知构造入参
 */
export interface BuildCommentMentionNotificationEventInput {
  bizKey: string
  receiverUserId: number
  actorUserId: number
  targetType: number
  targetId: number
  subjectId: number
  payload: CommentMentionNotificationPayload
  aggregateKey?: string
  aggregateCount?: number
  expiredAt?: Date | string
}

/**
 * 主题提及通知构造入参
 */
export interface BuildTopicMentionNotificationEventInput {
  bizKey: string
  receiverUserId: number
  actorUserId: number
  targetType: number
  targetId: number
  subjectId: number
  payload: TopicMentionNotificationPayload
  aggregateKey?: string
  aggregateCount?: number
  expiredAt?: Date | string
}
