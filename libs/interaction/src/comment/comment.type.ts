import type { UserComment } from '@db/schema'
import type { CommentTargetTypeEnum } from './comment.constant'
import type {
  CommentTargetMeta,
} from './interfaces/comment-target-resolver.interface'

/**
 * 事务冲突重试配置。
 * - maxRetries 表示最大重试次数
 */
export interface TransactionRetryOptions {
  maxRetries?: number
}

/**
 * 评论可见性判断输入。
 * - 与审核状态、隐藏标记、删除时间保持一致
 */
export type CommentVisibleState = Pick<
  UserComment,
  'auditStatus' | 'isHidden' | 'deletedAt'
>

/**
 * 创建一级评论入参。
 * - 包含用户、目标与评论内容
 */
export type CreateCommentInput = Pick<UserComment, 'userId' | 'targetId' | 'content'> & {
  targetType: CommentTargetTypeEnum
}

/**
 * 创建回复评论入参。
 * - 包含用户、回复目标与评论内容
 */
export type ReplyCommentInput = Pick<UserComment, 'userId' | 'content'> & {
  replyToId: number
}

/**
 * 回复列表查询入参。
 * - 以一级评论ID为主，支持分页
 */
export interface RepliesQuery {
  commentId: number
  pageIndex?: number
  pageSize?: number
}

/**
 * 用户评论列表查询入参。
 * - 支持目标与审核状态筛选并保留分页参数
 */
export interface UserCommentsQuery {
  pageIndex?: number
  pageSize?: number
  targetType?: number
  targetId?: number
  auditStatus?: number
}

/**
 * 目标评论列表查询入参。
 * - 用于作品/主题/章节等目标的一级评论分页
 */
export interface TargetCommentsQuery {
  targetType: CommentTargetTypeEnum
  targetId: number
  pageIndex?: number
  pageSize?: number
  previewReplyLimit?: number
}

/**
 * 可见评论补偿副作用载荷。
 * - 用于奖励与通知补偿流程
 */
export type VisibleCommentEffectPayload = Pick<
  UserComment,
  'id' | 'userId' | 'targetType' | 'targetId' | 'replyToId' | 'createdAt'
>

/**
 * 评论副作用补偿上下文。
 * - 由评论载荷与目标元数据组成
 */
export interface VisibleCommentEffectContext {
  comment: VisibleCommentEffectPayload
  meta: CommentTargetMeta
}
