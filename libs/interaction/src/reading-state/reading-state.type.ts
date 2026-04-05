import type {
  ReadingStateChapterSnapshot,
  ReadingStateWorkSnapshot,
} from './interfaces/reading-state-resolver.interface'

/**
 * 阅读历史基础行结构。
 * - 对齐 user_work_reading_state 表中的核心历史字段
 */
export interface ReadingHistoryRow {
  workId: number
  workType: number
  lastReadAt: Date
  lastReadChapterId: number | null
}

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
