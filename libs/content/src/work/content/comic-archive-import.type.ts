/**
 * 漫画压缩包导入任务状态。
 * 用于预解析草稿、确认导入和后台执行阶段的状态流转。
 */
export enum ComicArchiveTaskStatusEnum {
  DRAFT = 'draft',
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  PARTIAL_FAILED = 'partial_failed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * 漫画压缩包预解析模式。
 * 根目录直接是图片时按单章节处理，根目录存在章节目录时按多章节处理。
 */
export enum ComicArchivePreviewModeEnum {
  SINGLE_CHAPTER = 'single_chapter',
  MULTI_CHAPTER = 'multi_chapter',
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
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * 漫画压缩包预解析入参。
 * 单章节压缩包可显式携带 chapterId，多章节压缩包只使用 workId。
 */
export interface PreviewComicArchiveInput {
  workId: number
  chapterId?: number
}

/**
 * 漫画压缩包确认导入入参。
 * 前端只提交用户最终确认要执行导入的章节 ID 列表。
 */
export interface ConfirmComicArchiveImportInput {
  taskId: string
  confirmedChapterIds: number[]
}

/**
 * 漫画压缩包任务详情查询入参。
 * 用于管理端轮询预解析结果和后台导入状态。
 */
export interface GetComicArchiveTaskDetailInput {
  taskId: string
}

/**
 * 漫画压缩包预解析汇总结果。
 * 汇总匹配章节数、忽略项数量和有效图片总数。
 */
export interface ComicArchiveSummaryView {
  matchedChapterCount: number
  ignoredItemCount: number
  imageCount: number
}

/**
 * 漫画压缩包预解析忽略项。
 * 每条忽略项都包含稳定原因码和可直接展示给前端用户的提示。
 */
export interface ComicArchiveIgnoredItemView {
  path: string
  reason: ComicArchiveIgnoreReasonEnum
  message: string
}

/**
 * 漫画压缩包匹配成功的章节视图。
 * 这里会返回章节现有内容数量，便于前端在确认页提示覆盖风险。
 */
export interface ComicArchiveMatchedItemView {
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
 * 漫画压缩包单章节导入结果。
 * 用于前端查看确认后的章节执行状态与结果说明。
 */
export interface ComicArchiveResultItemView {
  chapterId: number
  chapterTitle: string
  importedImageCount: number
  status: ComicArchiveImportItemStatusEnum
  message: string
}

/**
 * 漫画压缩包任务对外详情视图。
 * 该视图既用于 preview 返回，也用于 detail 轮询返回。
 */
export interface ComicArchiveTaskView {
  taskId: string
  workId: number
  mode: ComicArchivePreviewModeEnum
  status: ComicArchiveTaskStatusEnum
  requireConfirm: boolean
  summary: ComicArchiveSummaryView
  matchedItems: ComicArchiveMatchedItemView[]
  ignoredItems: ComicArchiveIgnoredItemView[]
  resultItems: ComicArchiveResultItemView[]
  startedAt: Date | null
  finishedAt: Date | null
  expiresAt: Date
  lastError: string | null
}

/**
 * 漫画压缩包匹配项内部记录。
 * 额外保存解压后的本地图片路径，供正式导入阶段使用。
 */
export interface ComicArchiveMatchedItemRecord extends ComicArchiveMatchedItemView {
  imagePaths: string[]
}

/**
 * 漫画压缩包任务持久化记录。
 * 使用数据库行承载预解析草稿与导入执行状态，临时文件仍保留在本地目录。
 */
export interface ComicArchiveTaskRecord {
  taskId: string
  workId: number
  mode: ComicArchivePreviewModeEnum
  status: ComicArchiveTaskStatusEnum
  archiveName: string
  archivePath: string
  extractPath: string
  requireConfirm: boolean
  summary: ComicArchiveSummaryView
  matchedItems: ComicArchiveMatchedItemRecord[]
  ignoredItems: ComicArchiveIgnoredItemView[]
  resultItems: ComicArchiveResultItemView[]
  confirmedChapterIds: number[]
  startedAt: Date | null
  finishedAt: Date | null
  expiresAt: Date
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}
