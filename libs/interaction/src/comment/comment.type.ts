import type { AppUserSelect, UserCommentSelect } from '@db/schema'
import type { EventEnvelope } from '@libs/growth/event-definition/event-envelope.type'
import type { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import type { CompiledBodyResult } from '@libs/interaction/body/body.type'
import type { GeoSnapshot } from '@libs/platform/modules/geo/geo.type'
import type { QueryTargetCommentsDto } from './dto/comment.dto'
import type { CommentTargetMeta } from './interfaces/comment-target-resolver.type'

/** 评论列表展示所需的用户简要信息。 */
export type CommentUserBrief = Pick<
  AppUserSelect,
  'id' | 'nickname' | 'avatarUrl' | 'isEnabled' | 'status'
>

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
  | 'auditReason'
  | 'isHidden'
  | 'deletedAt'
> & {
  replyTargetUserId?: number
}

/**
 * 评论正文解析结果。
 * - 评论写链路统一通过 canonical body 编译后再落库。
 */
export interface CommentBodyWriteResult extends CompiledBodyResult {
  html: string
}

/**
 * 回复通知所需的父评论快照。
 * 仅承载通知文案和接收人判断需要的最小字段。
 */
export type ReplyTargetSnapshot = Pick<
  UserCommentSelect,
  'id' | 'userId' | 'content'
>

/**
 * 评论作者计数聚合增量。
 * 用于批量回写评论数与收到点赞数。
 */
export interface AuthorCommentDelta {
  commentCount: number
  receivedLikeCount: number
}

/**
 * 目标评论分页内部查询输入。
 * 公开查询 DTO 只承载 HTTP contract；预览数量和当前用户由 controller/service 链路内部装配。
 */
export type TargetCommentsQueryInput = QueryTargetCommentsDto & {
  previewReplyLimit?: number
  userId?: number
}

/** 评论创建奖励入参，承载评论关键字段与可选发生时间和事件外壳。 */
export type CommentCreatedRewardInput = Pick<
  UserCommentSelect,
  'userId' | 'id' | 'targetType' | 'targetId'
> & {
  occurredAt?: Date
  eventEnvelope?: EventEnvelope<GrowthRuleTypeEnum>
}

/** 评论被点赞奖励入参，承载评论 ID、作者 ID 与点赞者 ID。 */
export type CommentLikedRewardInput = Pick<
  UserCommentSelect,
  'id' | 'userId'
> & {
  likerUserId: number
}
