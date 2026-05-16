import type {
  ThirdPartyComicChapterDto,
  ThirdPartyComicImageDto,
} from '@libs/content/work/content/dto/content.dto'
import type {
  BackgroundTaskExecutionContext,
  BackgroundTaskObject,
  BackgroundTaskProgressReporter,
} from '@libs/platform/modules/background-task/types'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'

/** 第三方漫画最新章节同步任务负载。 */
export type ThirdPartyComicSyncTaskPayload = BackgroundTaskObject & {
  workId: number
  sourceBindingId: number
  platform: string
  providerComicId: string
  providerPathWord: string
  providerGroupPathWord: string
  sourceScopeKey: string
}

/** 第三方漫画最新章节同步失败或取消后的可回滚残留。 */
export type ThirdPartyComicSyncResidue = BackgroundTaskObject & {
  createdChapterIds?: number[]
  createdChapterBindingIds?: number[]
  uploadedFiles?: UploadDeleteTarget[]
}

/** 第三方漫画最新章节同步后台任务执行上下文。 */
export type ThirdPartyComicSyncTaskContext = BackgroundTaskExecutionContext<
  ThirdPartyComicSyncTaskPayload,
  ThirdPartyComicSyncResidue
>

/** 第三方漫画最新章节同步结果。 */
export type ThirdPartyComicSyncTaskResult = BackgroundTaskObject & {
  workId: number
  sourceBindingId: number
  scannedChapterCount: number
  skippedChapterCount: number
  createdChapterCount: number
  createdChapterIds: number[]
}

/** 第三方漫画同步单章节导入计划。 */
export type ThirdPartyComicSyncChapterPlan = BackgroundTaskObject & {
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
export type ThirdPartyComicSyncWorkSnapshot = {
  id: number
  chapterPrice: number
  canComment: boolean
}

/** 构建最新章节同步计划的内部输入。 */
export type ThirdPartyComicSyncChapterPlanBuildInput = {
  chapters: ThirdPartyComicChapterDto[]
  platform: string
  comicId: string
  group: string
  usedSortOrders: Set<number>
  context: ThirdPartyComicSyncTaskContext
}

/** 导入单个最新章节的内部输入。 */
export type ThirdPartyComicSyncImportNewChapterInput = {
  plan: ThirdPartyComicSyncChapterPlan
  work: ThirdPartyComicSyncWorkSnapshot
  sourceBindingId: number
  context: ThirdPartyComicSyncTaskContext
  imageProgressReporter: BackgroundTaskProgressReporter
}

/** 最新章节同步图片导入进度所需的安全载荷。 */
export type ThirdPartyComicSyncImageImportProgressFile = {
  image: ThirdPartyComicImageDto
  imageIndex: number
  imageTotal: number
  safeSourceUrl: string
  filePath: string
  fileSize?: number
  mimeType?: string
}
