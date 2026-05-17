import type {
  ThirdPartyComicDetailDto,
  ThirdPartyComicImageDto,
  ThirdPartyComicImportChapterItemDto,
  ThirdPartyComicImportRequestDto,
  ThirdPartyComicImportResultDto,
  ThirdPartyComicSourceSnapshotDto,
} from '@libs/content/work/content/dto/content.dto'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'
import type {
  WorkflowExecutionContext,
  WorkflowExpiredAttemptRecoveryContext,
  WorkflowObject,
  WorkflowProgress,
} from '@libs/platform/modules/workflow/workflow.type'
import type { Buffer } from 'node:buffer'
import type { LookupAddress } from 'node:dns'

export interface ThirdPartyComicImportProgressReporterOptions {
  startPercent?: number
  endPercent?: number
  total: number
  stage?: string
  unit?: string
  message?: string | null
  detail?: WorkflowObject
}

export interface ThirdPartyComicImportProgressReporterAdvanceInput {
  amount?: number
  current?: number
  message?: string | null
  detail?: WorkflowObject
}

export type ThirdPartyComicImportProgress = WorkflowProgress & {
  current: number
  detail?: WorkflowObject
  stage?: string
  total: number
  unit?: string
}

export interface ThirdPartyComicImportProgressReporter {
  advance: (
    input?: ThirdPartyComicImportProgressReporterAdvanceInput,
  ) => Promise<ThirdPartyComicImportProgress>
}

/** 第三方漫画更新章节的回滚快照。 */
export type ThirdPartyComicUpdatedChapterSnapshot = WorkflowObject & {
  id: number
  title: string
  subtitle: string | null
  cover: string | null
  description: string | null
  sortOrder: number
  isPublished: boolean
  isPreview: boolean
  publishAt: Date | null
  viewRule: number
  requiredViewLevelId: number | null
  price: number
  canDownload: boolean
  canComment: boolean
  content: string | null
}

/** 第三方漫画导入失败或取消后的可回滚残留。 */
export type ThirdPartyComicImportResidue = WorkflowObject & {
  createdWorkIds?: number[]
  createdChapterIds?: number[]
  createdSourceBindingIds?: number[]
  createdChapterBindingIds?: number[]
  updatedChapters?: ThirdPartyComicUpdatedChapterSnapshot[]
  uploadedFiles?: UploadDeleteTarget[]
}

/** 第三方漫画导入 workflow 负载。 */
export type ThirdPartyComicImportTaskPayload = ThirdPartyComicImportRequestDto &
  WorkflowObject

/** 第三方漫画导入 workflow 过期 attempt 恢复上下文。 */
export type ThirdPartyComicImportExpiredAttemptContext =
  WorkflowExpiredAttemptRecoveryContext

/** 第三方漫画导入 workflow 执行上下文。 */
export type ThirdPartyComicImportTaskContext = Pick<
  WorkflowExecutionContext,
  | 'assertNotCancelled'
  | 'isCancelRequested'
  | 'updateProgress'
> & {
  jobId: string
  workflowType: string
  payload: ThirdPartyComicImportTaskPayload
  assertStillOwned: () => Promise<void>
  createProgressReporter: (
    options: ThirdPartyComicImportProgressReporterOptions,
  ) => ThirdPartyComicImportProgressReporter
  getResidue: () => Promise<ThirdPartyComicImportResidue>
  recordResidue: (patch: Partial<ThirdPartyComicImportResidue>) => Promise<void>
  markUploadedFileResidueCleaned: (
    uploadedFile: UploadDeleteTarget,
  ) => Promise<void>
  markUploadedFileResidueCleanupFailed: (
    uploadedFile: UploadDeleteTarget,
    errorMessage: string,
  ) => Promise<void>
  markUploadedResiduesCleaned: () => Promise<void>
}

/** 第三方漫画导入任务 reservation 字段，供入队与重试校验共用。 */
export interface ThirdPartyComicImportReservation {
  dedupeKey: string
  dedupeConflictMessage: string
  serialKey: string
  conflictKeys: string[]
  conflictMessageByKey: Record<string, string>
}

/** 第三方漫画导入预检解析后的本地作品目标。 */
export interface ThirdPartyComicImportPlannedWork {
  id: number | null
  name: string
}

/** 第三方漫画导入 reservation 构建上下文。 */
export interface ThirdPartyComicImportReservationContext {
  dto: ThirdPartyComicImportRequestDto
  platform: string
  providerComicId: string
  providerGroupPathWord: string
  plannedWork: ThirdPartyComicImportPlannedWork
  chapterTitles: string[]
}

/** 第三方漫画导入重试时持久化的 reservation 快照。 */
export interface ThirdPartyComicRetryReservationSnapshot {
  dedupeKey: null | string
  serialKey: null | string
  conflictKeys: string[]
}

/** 第三方漫画导入 workflow 草稿，包含展示名与 reservation 快照。 */
export interface ThirdPartyComicImportTaskDraft {
  displayName: string
  reservation: ThirdPartyComicImportReservation
}

/** 第三方漫画导入 workflow 执行前准备出的稳定目标。 */
export interface ThirdPartyComicPreparedWorkflowImport {
  cover: ThirdPartyComicImportResultDto['cover']
  mode: ThirdPartyComicImportRequestDto['mode']
  work: NonNullable<ThirdPartyComicImportResultDto['work']>
  sourceBinding: {
    id: number
    providerGroupPathWord: string
  }
  chapterPlans: ThirdPartyComicChapterImportPlan[]
}

/** 第三方漫画导入 workflow 准备结果 Promise 解包类型。 */
export type ThirdPartyComicPreparedWorkflowImportResult =
  ThirdPartyComicPreparedWorkflowImport

/** 第三方漫画章节导入计划，确保读取远端内容早于本地章节副作用。 */
export type ThirdPartyComicChapterImportPlan = WorkflowObject & {
  chapter: ThirdPartyComicImportChapterItemDto
  chapterIndex: number
  chapterTotal: number
  images: ThirdPartyComicImageDto[]
  imageTotal: number
}

/** 第三方漫画图片进度详情，写入 workflow progress.detail。 */
export type ThirdPartyComicImageImportProgressDetail = WorkflowObject & {
  providerChapterId: string
  chapterIndex: number
  chapterTotal: number
  providerImageId: string
  imageIndex: number
  imageTotal: number
  safeSourceUrl: string
  filePath: string
  fileSize?: number
  mimeType?: string
}

/** 远程图片导入成功回调载荷，供调用方记录残留和推进进度。 */
export type RemoteImageImportSuccessPayload = WorkflowObject & {
  image: ThirdPartyComicImageDto
  imageIndex: number
  imageTotal: number
  safeSourceUrl: string
  filePath: string
  deleteTarget: UploadDeleteTarget
  fileSize?: number
  mimeType?: string
}

/** 第三方漫画导入本地事实预检入参。 */
export interface ThirdPartyComicImportPreflightInput {
  dto: ThirdPartyComicImportRequestDto
  plannedWork: ThirdPartyComicImportPlannedWork
  providerComicId: string
  providerGroupPathWord: string
}

/** 第三方漫画导入封面 provider 上下文。 */
export interface ThirdPartyComicImportCoverProviderContext {
  detail: ThirdPartyComicDetailDto
  sourceSnapshot: ThirdPartyComicSourceSnapshotDto
}

/** 远程图片导入成功回调。 */
export type RemoteImageImportSuccessHandler = (
  payload: RemoteImageImportSuccessPayload,
) => Promise<void>

/** 完成基础 URL 与 DNS 校验后的远程图片请求目标。 */
export interface SafeRemoteImageUrl {
  url: URL
  address?: LookupAddress
}

/** 原生下载完成后的远程图片响应摘要。 */
export interface DownloadedRemoteImage {
  buffer: Buffer
  contentType: string
}

/** 远程图片导入失败上下文，只包含可安全落库的定位信息。 */
export type RemoteImageImportFailureContext = WorkflowObject & {
  stage: 'remote-image-import'
  safeSourceUrl: string
  providerImageId: string
  imageIndex: number
  imageTotal: number
  originalName?: string
  originalMessage?: string
  originalCode?: number | string
  originalCause?: unknown
}
