import type { UserWorkReadingState } from '@db/schema'
import type {
  ReadingStateChapterSnapshot,
  ReadingStateWorkSnapshot,
} from './interfaces/reading-state-resolver.interface'

/**
 * 阅读历史分页查询条件。
 * - 以用户ID为主过滤，支持按作品ID/作品类型筛选
 * - 分页参数保持与 PageDto 语义一致
 */
export type ReadingHistoryQuery = Pick<UserWorkReadingState, 'userId'> &
  Partial<Pick<UserWorkReadingState, 'workId' | 'workType'>> & {
    pageIndex?: number
    pageSize?: number
  }

/**
 * 按作品更新阅读状态的入参。
 * - 必填用户与作品定位字段
 * - 最近阅读章节与最近阅读时间为可选更新字段
 */
export type TouchByWorkInput = Pick<
  UserWorkReadingState,
  'userId' | 'workId' | 'workType'
> &
Partial<Pick<UserWorkReadingState, 'lastReadChapterId' | 'lastReadAt'>>

/**
 * 阅读历史基础行结构。
 * - 对齐 user_work_reading_state 表中的核心历史字段
 */
export type ReadingHistoryRow = Pick<
  UserWorkReadingState,
  'workId' | 'workType' | 'lastReadAt' | 'lastReadChapterId'
>

/**
 * 阅读历史分组处理中间结构。
 * - 在基础行上追加原列表索引，用于重建稳定顺序
 */
export type ReadingHistoryIndexedRow = ReadingHistoryRow & { index: number }

/**
 * 阅读历史最终返回项。
 * - 基础行 + 作品快照 + 继续阅读章节快照
 */
export type ReadingHistoryItem = ReadingHistoryRow & {
  work: ReadingStateWorkSnapshot
  continueChapter: ReadingStateChapterSnapshot | undefined
}
