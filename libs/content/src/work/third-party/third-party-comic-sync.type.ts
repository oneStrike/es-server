import type {
  ThirdPartyComicChapterDto,
  ThirdPartyComicImageDto,
} from '@libs/content/work/content/dto/content.dto'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'
import type {
  WorkflowExecutionContext,
  WorkflowExpiredAttemptRecoveryContext,
  WorkflowObject,
} from '@libs/platform/modules/workflow/workflow.type'
import type {
  ThirdPartyComicImportProgressReporter,
  ThirdPartyComicImportProgressReporterOptions,
} from './third-party-comic-import.type'

/** 第三方漫画最新章节同步任务负载。 */
export type ThirdPartyComicSyncTaskPayload = WorkflowObject & {
  workId: number
  sourceBindingId: number
  platform: string
  providerComicId: string
  providerPathWord: string
  providerGroupPathWord: string
  sourceScopeKey: string
}

/** 第三方漫画同步 workflow 过期 attempt 恢复上下文。 */
export type ThirdPartyComicSyncExpiredAttemptContext =
  WorkflowExpiredAttemptRecoveryContext

/** 第三方漫画最新章节同步失败或取消后的可回滚残留。 */
export type ThirdPartyComicSyncResidue = WorkflowObject & {
  createdChapterIds?: number[]
  createdChapterBindingIds?: number[]
  uploadedFiles?: UploadDeleteTarget[]
}

/** 第三方漫画最新章节同步 workflow 执行上下文。 */
export type ThirdPartyComicSyncTaskContext = Pick<
  WorkflowExecutionContext,
  | 'assertNotCancelled'
  | 'isCancelRequested'
  | 'updateProgress'
> & {
  jobId: string
  workflowType: string
  payload: ThirdPartyComicSyncTaskPayload
  assertStillOwned: () => Promise<void>
  createProgressReporter: (
    options: ThirdPartyComicImportProgressReporterOptions,
  ) => ThirdPartyComicImportProgressReporter
  getResidue: () => Promise<ThirdPartyComicSyncResidue>
  recordResidue: (patch: Partial<ThirdPartyComicSyncResidue>) => Promise<void>
  markUploadedFileResidueCleaned: (
    uploadedFile: UploadDeleteTarget,
  ) => Promise<void>
  markUploadedFileResidueCleanupFailed: (
    uploadedFile: UploadDeleteTarget,
    errorMessage: string,
  ) => Promise<void>
  markUploadedResiduesCleaned: () => Promise<void>
}

/** 第三方漫画最新章节同步结果。 */
export type ThirdPartyComicSyncTaskResult = WorkflowObject & {
  workId: number
  sourceBindingId: number
  scannedChapterCount: number
  skippedChapterCount: number
  createdChapterCount: number
  createdChapterIds: number[]
}

/** 第三方漫画同步单章节导入计划。 */
export type ThirdPartyComicSyncChapterPlan = WorkflowObject & {
  providerChapterId: string
  title: string
  group?: string
  sortOrder: number
  chapterApiVersion?: number
  datetimeCreated?: string
  localSortOrder: number
  images: ThirdPartyComicImageDto[]
  imageTotal: number
  chapterIndex: number
  chapterTotal: number
}

/** 第三方漫画同步所需的本地作品快照。 */
export interface ThirdPartyComicSyncWorkSnapshot {
  id: number
  chapterPrice: number
  canComment: boolean
}

/** 第三方漫画同步 workflow 扫描后的准备结果。 */
export interface ThirdPartyComicPreparedWorkflowSync {
  createdChapterCount: number
  plans: ThirdPartyComicSyncChapterPlan[]
  scannedChapterCount: number
  skippedChapterCount: number
  sourceBindingId: number
  work: ThirdPartyComicSyncWorkSnapshot
}

/** 第三方漫画同步 workflow 的本地目标快照。 */
export interface ThirdPartyComicWorkflowSyncTarget {
  sourceBindingId: number
  work: ThirdPartyComicSyncWorkSnapshot
}

/** 构建最新章节同步计划的内部输入。 */
export interface ThirdPartyComicSyncChapterPlanBuildInput {
  chapters: ThirdPartyComicChapterDto[]
  platform: string
  comicId: string
  group: string
  usedSortOrders: Set<number>
  context: ThirdPartyComicSyncTaskContext
}

/** 导入单个最新章节的内部输入。 */
export interface ThirdPartyComicSyncImportNewChapterInput {
  plan: ThirdPartyComicSyncChapterPlan
  work: ThirdPartyComicSyncWorkSnapshot
  sourceBindingId: number
  context: ThirdPartyComicSyncTaskContext
  imageProgressReporter: ThirdPartyComicImportProgressReporter
}

/** 最新章节同步图片导入进度所需的安全载荷。 */
export interface ThirdPartyComicSyncImageImportProgressFile {
  image: ThirdPartyComicImageDto
  imageIndex: number
  imageTotal: number
  safeSourceUrl: string
  filePath: string
  fileSize?: number
  mimeType?: string
}
