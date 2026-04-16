/**
 * 漫画压缩包导入任务状态。
 * 用于预解析草稿、确认导入和后台执行阶段的状态流转。
 */
export enum ComicArchiveTaskStatusEnum {
  DRAFT = 0,
  PENDING = 1,
  PROCESSING = 2,
  SUCCESS = 3,
  PARTIAL_FAILED = 4,
  FAILED = 5,
  EXPIRED = 6,
  CANCELLED = 7,
}

/**
 * 漫画压缩包预解析模式。
 * 根目录直接是图片时按单章节处理，根目录存在章节目录时按多章节处理。
 */
export enum ComicArchivePreviewModeEnum {
  SINGLE_CHAPTER = 1,
  MULTI_CHAPTER = 2,
}

/**
 * 漫画压缩包忽略原因码。
 * 数字码会直接返回给前端用于友好提示和分组展示。
 */
export enum ComicArchiveIgnoreReasonEnum {
  INVALID_CHAPTER_ID_DIR = 1001,
  CHAPTER_NOT_FOUND = 1002,
  NESTED_DIRECTORY_IGNORED = 1003,
  MISSING_CHAPTER_ID = 1004,
  INVALID_IMAGE_FILE = 1005,
}

/**
 * 漫画压缩包单章节导入结果状态。
 * 用于前端查看每个确认章节的执行结果。
 */
export enum ComicArchiveImportItemStatusEnum {
  PENDING = 0,
  SUCCESS = 1,
  FAILED = 2,
}

/**
 * 漫画压缩包预解析汇总快照。
 * 汇总匹配章节数、忽略项数量和有效图片总数。
 */
/** 稳定领域类型 `ComicArchiveSummarySnapshot`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ComicArchiveSummarySnapshot {
  matchedChapterCount: number
  ignoredItemCount: number
  imageCount: number
}

/**
 * 漫画压缩包预解析忽略项快照。
 * 每条忽略项都包含稳定原因码和可直接展示给前端用户的提示。
 */
/** 稳定领域类型 `ComicArchiveIgnoredItemSnapshot`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ComicArchiveIgnoredItemSnapshot {
  path: string
  reason: ComicArchiveIgnoreReasonEnum
  message: string
}

/**
 * 漫画压缩包匹配成功的章节快照。
 * 这里会返回章节现有内容数量，便于前端在确认页提示覆盖风险。
 */
/** 稳定领域类型 `ComicArchiveMatchedItemSnapshot`。仅供内部领域/服务链路复用，避免重复定义。 */
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
/** 稳定领域类型 `ComicArchiveResultItemSnapshot`。仅供内部领域/服务链路复用，避免重复定义。 */
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
/** 稳定领域类型 `ComicArchiveMatchedItemRecord`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ComicArchiveMatchedItemRecord extends ComicArchiveMatchedItemSnapshot {
  imagePaths: string[]
}

/**
 * 漫画压缩包任务持久化记录。
 * 使用数据库行承载预解析草稿与导入执行状态，临时文件仍保留在本地目录。
 */
/** 稳定领域类型 `ComicArchiveTaskRecord`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ComicArchiveTaskRecord {
  taskId: string
  workId: number
  mode: ComicArchivePreviewModeEnum
  status: ComicArchiveTaskStatusEnum
  archiveName: string
  archivePath: string
  extractPath: string
  requireConfirm: boolean
  summary: ComicArchiveSummarySnapshot
  matchedItems: ComicArchiveMatchedItemRecord[]
  ignoredItems: ComicArchiveIgnoredItemSnapshot[]
  resultItems: ComicArchiveResultItemSnapshot[]
  confirmedChapterIds: number[]
  startedAt: Date | null
  finishedAt: Date | null
  expiresAt: Date
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}
