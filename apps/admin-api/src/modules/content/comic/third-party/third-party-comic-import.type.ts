import type { ThirdPartyComicImportRequestDto } from '@libs/content/work/content/dto/content.dto'
import type {
  BackgroundTaskExecutionContext,
  BackgroundTaskObject,
} from '@libs/platform/modules/background-task/types'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'

/** 第三方漫画更新章节的回滚快照。 */
export type ThirdPartyComicUpdatedChapterSnapshot = BackgroundTaskObject & {
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
export type ThirdPartyComicImportResidue = BackgroundTaskObject & {
  createdWorkIds?: number[]
  createdChapterIds?: number[]
  updatedChapters?: ThirdPartyComicUpdatedChapterSnapshot[]
  uploadedFiles?: UploadDeleteTarget[]
}

/** 第三方漫画导入后台任务负载。 */
export type ThirdPartyComicImportTaskPayload = ThirdPartyComicImportRequestDto &
  BackgroundTaskObject

/** 第三方漫画导入后台任务执行上下文。 */
export type ThirdPartyComicImportTaskContext = BackgroundTaskExecutionContext<
  ThirdPartyComicImportTaskPayload,
  ThirdPartyComicImportResidue
>
