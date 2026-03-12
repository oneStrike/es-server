/**
 * 交互模块通用类型定义。
 */

import type {
  AuditRoleEnum,
  AuditStatusEnum,
  CommentLevelEnum,
  InteractionTargetTypeEnum,
  SceneTypeEnum,
} from '@libs/base/constant'
import type {
  ReportReasonEnum,
  ReportStatusEnum,
  ReportTargetTypeEnum,
} from './report/report.constant'

/**
 * 交互记录基础接口。
 */
export interface IInteractionRecord {
  id: number
  userId: number
  createdAt: Date
}

/**
 * 多态目标基础接口。
 */
export interface IInteractionTarget {
  targetType: InteractionTargetTypeEnum
  targetId: number
}

/**
 * 点赞记录接口。
 *
 * 说明：
 * - 点赞表会冗余场景维度，便于直接统计
 */
export interface ILikeRecord extends IInteractionRecord, IInteractionTarget {
  sceneType: SceneTypeEnum
  sceneId: number
  commentLevel?: CommentLevelEnum | null
}

/**
 * 收藏记录接口。
 */
export interface IFavoriteRecord extends IInteractionRecord, IInteractionTarget {}

/**
 * 浏览记录接口。
 */
export interface IViewRecord extends IInteractionRecord, IInteractionTarget {
  ipAddress?: string | null
  device?: string | null
  userAgent?: string | null
  viewedAt: Date
}

/**
 * 评论记录接口。
 */
export interface ICommentRecord extends IInteractionRecord, IInteractionTarget {
  content: string
  floor?: number | null
  replyToId?: number | null
  actualReplyToId?: number | null
  isHidden: boolean
  auditStatus: AuditStatusEnum
  auditReason?: string | null
  auditAt?: Date | null
  auditById?: number | null
  auditRole?: AuditRoleEnum | null
  likeCount: number
  sensitiveWordHits?: unknown
  updatedAt: Date
  deletedAt?: Date | null
}

/**
 * 举报记录接口。
 *
 * 说明：
 * - 举报表同样会冗余场景维度
 * - `targetType` 使用举报模块自己的枚举，而不是点赞枚举
 */
export interface IReportRecord {
  id: number
  reporterId: number
  handlerId?: number | null
  targetType: ReportTargetTypeEnum
  targetId: number
  sceneType: SceneTypeEnum
  sceneId: number
  commentLevel?: CommentLevelEnum | null
  reasonType: ReportReasonEnum
  description?: string | null
  evidenceUrl?: string | null
  status: ReportStatusEnum
  handlingNote?: string | null
  handledAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * 下载记录接口。
 */
export interface IDownloadRecord extends IInteractionRecord, IInteractionTarget {
  workId: number
  workType: number
}

/**
 * 用户交互状态接口。
 */
export interface IUserInteractionStatus {
  isLiked: boolean
  isFavorited: boolean
  isDownloaded: boolean
}

/**
 * 交互计数接口。
 */
export interface IInteractionCounts {
  likeCount: number
  favoriteCount: number
  viewCount: number
  commentCount: number
  downloadCount: number
}

/**
 * 分页查询参数接口。
 */
export interface IInteractionQueryParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * 分页查询结果接口。
 */
export interface IInteractionQueryResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
