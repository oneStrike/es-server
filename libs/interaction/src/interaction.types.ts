/**
 * 交互模块类型定义
 */

import type { InteractionTargetType, InteractionActionType, AuditStatus, AuditRole, ReportStatus } from './interaction.constant'

/**
 * 交互记录基础接口
 */
export interface IInteractionRecord {
  id: number
  userId: number
  createdAt: Date
}

/**
 * 目标对象接口
 */
export interface IInteractionTarget {
  targetType: InteractionTargetType
  targetId: number
}

/**
 * 点赞记录接口
 */
export interface ILikeRecord extends IInteractionRecord, IInteractionTarget {}

/**
 * 收藏记录接口
 */
export interface IFavoriteRecord extends IInteractionRecord, IInteractionTarget {}

/**
 * 浏览记录接口
 */
export interface IViewRecord extends IInteractionRecord, IInteractionTarget {
  ipAddress?: string | null
  device?: string | null
  userAgent?: string | null
  viewedAt: Date
}

/**
 * 评论记录接口
 */
export interface ICommentRecord extends IInteractionRecord, IInteractionTarget {
  content: string
  floor?: number | null
  replyToId?: number | null
  actualReplyToId?: number | null
  isHidden: boolean
  auditStatus: AuditStatus
  auditReason?: string | null
  auditAt?: Date | null
  auditById?: number | null
  auditRole?: AuditRole | null
  likeCount: number
  sensitiveWordHits?: unknown
  updatedAt: Date
  deletedAt?: Date | null
}

/**
 * 评论点赞记录接口
 */
export interface ICommentLikeRecord extends IInteractionRecord {
  commentId: number
}

/**
 * 评论举报记录接口
 */
export interface ICommentReportRecord extends IInteractionRecord {
  reporterId: number
  handlerId?: number | null
  commentId: number
  reason: string
  description?: string | null
  evidenceUrl?: string | null
  status: ReportStatus
  handlingNote?: string | null
  handledAt?: Date | null
  updatedAt: Date
}

/**
 * 下载记录接口
 */
export interface IDownloadRecord extends IInteractionRecord, IInteractionTarget {
  workId: number
  workType: number
}

/**
 * 用户交互状态接口
 */
export interface IUserInteractionStatus {
  isLiked: boolean
  isFavorited: boolean
  isDownloaded: boolean
}

/**
 * 交互计数接口
 */
export interface IInteractionCounts {
  likeCount: number
  favoriteCount: number
  viewCount: number
  commentCount: number
  downloadCount: number
}

// 注意：ITargetValidationResult 和 ITargetValidator 接口定义在 validator/target-validator.interface.ts 中
// 请从该文件导入，避免重复定义

/**
 * 分页查询参数接口
 */
export interface IInteractionQueryParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * 分页查询结果接口
 */
export interface IInteractionQueryResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
