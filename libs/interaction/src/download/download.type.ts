import type { UserDownloadRecord } from '@db/schema'
import type { DownloadTargetTypeEnum } from './download.constant'

/**
 * 下载目标入参。
 * - 用于下载、重复下载兜底与状态查询
 */
export type DownloadTargetInput = Pick<
  UserDownloadRecord,
  'targetId' | 'userId'
> & {
  targetType: DownloadTargetTypeEnum
}

/**
 * 已下载作品列表查询入参。
 * - 支持作品类型与时间区间筛选
 * - 分页参数与 PageDto 语义保持一致
 */
export interface DownloadedWorksQuery {
  userId: number
  workType?: number
  pageIndex?: number
  pageSize?: number
  startDate?: string
  endDate?: string
}

/**
 * 已下载章节列表查询入参。
 * - 在已下载作品查询入参基础上增加作品ID
 */
export interface DownloadedWorkChaptersQuery extends DownloadedWorksQuery {
  workId: number
}

/**
 * 已下载作品聚合查询行。
 * - 对应已下载作品列表 SQL 查询结果结构
 */
export interface DownloadedWorkRow {
  workId: number
  workType: number
  workName: string
  workCover: string
  downloadedChapterCount: bigint
  lastDownloadedAt: Date
}

/**
 * 已下载作品总数查询行。
 * - 对应 COUNT(DISTINCT work_id) 聚合结果
 */
export interface DownloadedWorkTotalRow {
  total: bigint
}

/**
 * 已下载章节列表查询行。
 * - 对应已下载章节列表 SQL 查询结果结构
 */
export interface DownloadedWorkChapterRow {
  id: number
  targetType: number
  targetId: number
  userId: number
  createdAt: Date
  chapterId: number
  chapterWorkId: number
  chapterWorkType: number
  chapterTitle: string
  chapterSubtitle: string | null
  chapterCover: string | null
  chapterSortOrder: number
  chapterIsPublished: boolean
  chapterPublishAt: Date | null
}

/**
 * 已下载章节总数查询行。
 * - 对应 COUNT(*) 聚合结果
 */
export interface DownloadedWorkChapterTotalRow {
  total: bigint
}
