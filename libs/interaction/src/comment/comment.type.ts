import type { UserComment } from '@db/schema'
import type { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
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
  userId?: number
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
 * 管理端评论分页查询入参。
 * - 追加评论自身、回复链、隐藏状态与关键词筛选
 */
export interface AdminCommentsQuery extends UserCommentsQuery {
  id?: number
  userId?: number
  replyToId?: number | null
  actualReplyToId?: number | null
  isHidden?: boolean
  keyword?: string
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
  userId?: number
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

/**
 * 评论治理状态快照。
 * - 用于审核/隐藏更新时判断可见性迁移
 */
export type CommentModerationState = Pick<
  UserComment,
  | 'id'
  | 'userId'
  | 'targetType'
  | 'targetId'
  | 'replyToId'
  | 'createdAt'
  | 'auditStatus'
  | 'isHidden'
  | 'deletedAt'
>

/**
 * 管理端更新评论审核状态入参。
 * - 记录审核人和审核角色，避免后台链路丢失治理上下文
 */
export interface UpdateCommentAuditStatusInput {
  id: number
  auditStatus: AuditStatusEnum
  auditReason?: string | null
  auditById: number
  auditRole?: AuditRoleEnum
}

/**
 * 管理端更新评论隐藏状态入参。
 * - 隐藏与取消隐藏会影响评论可见性及补偿链路
 */
export interface UpdateCommentHiddenInput {
  id: number
  isHidden: boolean
}
