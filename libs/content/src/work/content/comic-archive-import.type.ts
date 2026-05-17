import type {
  ComicArchiveIgnoreReasonEnum,
  ComicArchiveImportItemStatusEnum,
} from './comic-archive-import.constant'

/**
 * 漫画压缩包预解析汇总快照。
 * 汇总匹配章节数、忽略项数量和有效图片总数。
 */
export interface ComicArchiveSummarySnapshot {
  matchedChapterCount: number
  ignoredItemCount: number
  imageCount: number
}

/**
 * 漫画压缩包预解析忽略项快照。
 * 每条忽略项都包含稳定原因码和可直接展示给前端用户的提示。
 */
export interface ComicArchiveIgnoredItemSnapshot {
  path: string
  reason: ComicArchiveIgnoreReasonEnum
  message: string
}

/**
 * 漫画压缩包匹配成功的章节快照。
 * 这里会返回章节现有内容数量，便于前端在确认页提示覆盖风险。
 */
export interface ComicArchiveMatchedItemSnapshot {
  path: string
  chapterId: number
  chapterTitle: string
  imageCount: number
  hasExistingContent: boolean
  existingImageCount: number
  importMode: 'replace'
  message: string
  warningMessage: string
}

/**
 * 漫画压缩包单章节导入结果快照。
 * 用于前端查看确认后的章节执行状态与结果说明。
 */
export interface ComicArchiveResultItemSnapshot {
  chapterId: number
  chapterTitle: string
  importedImageCount: number
  status: ComicArchiveImportItemStatusEnum
  message: string
}

/**
 * 漫画压缩包匹配项内部记录。
 * 额外保存解压后的本地图片路径，供正式导入阶段使用。
 */
export interface ComicArchiveMatchedItemRecord extends ComicArchiveMatchedItemSnapshot {
  imagePaths: string[]
}

/**
 * 漫画压缩包预解析阶段可匹配的章节快照。
 * 只保留匹配目录、展示标题和现有内容统计需要的字段。
 */
export interface ComicArchivePreviewChapter {
  id: number
  title: string
  content: string | null
}

/**
 * 漫画压缩包预解析章节索引。
 * 以章节 ID 为键，供单章节和多章节预解析路径复用。
 */
export type ComicArchivePreviewChapterMap = Map<
  number,
  ComicArchivePreviewChapter
>

/** 漫画压缩包 workflow 执行单条导入所需的上下文记录。 */
export interface ArchiveWorkflowImportRecord {
  assertStillOwned: () => Promise<void>
  attemptId: string
  itemId: string
  jobId: string
  workId: number
}

/** 漫画压缩包导入详情查询入参。 */
export interface ComicArchiveDetailInput {
  jobId: string
}
