import type { UserCommentSelect } from '@db/schema'
import type { GeoSnapshot } from '@libs/platform/modules/geo/geo.types'
import type {
  CommentTargetMeta,
} from './interfaces/comment-target-resolver.interface'

/**
 * 事务冲突重试配置。
 * - maxRetries 表示最大重试次数
 */
/** 稳定领域类型 `TransactionRetryOptions`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface TransactionRetryOptions {
  maxRetries?: number
}

/**
 * 评论可见性判断输入。
 * - 与审核状态、隐藏标记、删除时间保持一致
 */
/** 稳定领域类型 `CommentVisibleState`。仅供内部领域/服务链路复用，避免重复定义。 */
export type CommentVisibleState = Pick<
  UserCommentSelect,
  'auditStatus' | 'isHidden' | 'deletedAt'
>

/**
 * 可见评论补偿副作用载荷。
 * - 用于奖励与通知补偿流程
 */
/** 稳定领域类型 `VisibleCommentEffectPayload`。仅供内部领域/服务链路复用，避免重复定义。 */
export type VisibleCommentEffectPayload = Pick<
  UserCommentSelect,
  | 'id'
  | 'userId'
  | 'targetType'
  | 'targetId'
  | 'replyToId'
  | 'content'
  | 'createdAt'
> & {
  replyTargetUserId?: number
}

/**
 * 评论副作用补偿上下文。
 * - 由评论载荷与目标元数据组成
 */
/** 稳定领域类型 `VisibleCommentEffectContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface VisibleCommentEffectContext {
  comment: VisibleCommentEffectPayload
  meta: CommentTargetMeta
}

/**
 * 评论写入链路使用的属地上下文。
 * 评论表只持久化属地快照，不复用 HTTP 层的完整请求对象。
 */
/** 稳定领域类型 `CommentWriteContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface CommentWriteContext extends GeoSnapshot {}

/**
 * 评论治理状态快照。
 * - 用于审核/隐藏更新时判断可见性迁移
 */
/** 稳定领域类型 `CommentModerationState`。仅供内部领域/服务链路复用，避免重复定义。 */
export type CommentModerationState = Pick<
  UserCommentSelect,
  | 'id'
  | 'userId'
  | 'targetType'
  | 'targetId'
  | 'replyToId'
  | 'content'
  | 'createdAt'
  | 'auditStatus'
  | 'isHidden'
  | 'deletedAt'
> & {
  replyTargetUserId?: number
}
