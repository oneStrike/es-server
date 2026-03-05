/**
 * 浜や簰妯″潡绫诲瀷瀹氫箟
 */

import type { AuditRole, AuditStatus, InteractionTargetType, ReportStatus } from './common.constant'

/**
 * 浜や簰璁板綍鍩虹鎺ュ彛
 */
export interface IInteractionRecord {
  id: number
  userId: number
  createdAt: Date
}

/**
 * 鐩爣瀵硅薄鎺ュ彛
 */
export interface IInteractionTarget {
  targetType: InteractionTargetType
  targetId: number
}

/**
 * 鐐硅禐璁板綍鎺ュ彛
 */
export interface ILikeRecord extends IInteractionRecord, IInteractionTarget {}

/**
 * 鏀惰棌璁板綍鎺ュ彛
 */
export interface IFavoriteRecord extends IInteractionRecord, IInteractionTarget {}

/**
 * 娴忚璁板綍鎺ュ彛
 */
export interface IViewRecord extends IInteractionRecord, IInteractionTarget {
  ipAddress?: string | null
  device?: string | null
  userAgent?: string | null
  viewedAt: Date
}

/**
 * 璇勮璁板綍鎺ュ彛
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
 * 璇勮鐐硅禐璁板綍鎺ュ彛
 */
export interface ICommentLikeRecord extends IInteractionRecord {
  commentId: number
}

/**
 * 璇勮涓炬姤璁板綍鎺ュ彛
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
 * 涓嬭浇璁板綍鎺ュ彛
 */
export interface IDownloadRecord extends IInteractionRecord, IInteractionTarget {
  workId: number
  workType: number
}

/**
 * 鐢ㄦ埛浜や簰鐘舵€佹帴鍙?
 */
export interface IUserInteractionStatus {
  isLiked: boolean
  isFavorited: boolean
  isDownloaded: boolean
}

/**
 * 浜や簰璁℃暟鎺ュ彛
 */
export interface IInteractionCounts {
  likeCount: number
  favoriteCount: number
  viewCount: number
  commentCount: number
  downloadCount: number
}

// 璇蜂粠璇ユ枃浠跺鍏ワ紝閬垮厤閲嶅瀹氫箟

/**
 * 鍒嗛〉鏌ヨ鍙傛暟鎺ュ彛
 */
export interface IInteractionQueryParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * 鍒嗛〉鏌ヨ缁撴灉鎺ュ彛
 */
export interface IInteractionQueryResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
