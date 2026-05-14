import type {
  ThirdPartyComicImageDto,
  ThirdPartyComicImportChapterItemDto,
  ThirdPartyComicImportRequestDto,
} from '@libs/content/work/content/dto/content.dto'
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

/** 第三方漫画章节导入计划，确保读取远端内容早于本地章节副作用。 */
export type ThirdPartyComicChapterImportPlan = BackgroundTaskObject & {
  chapter: ThirdPartyComicImportChapterItemDto
  chapterIndex: number
  chapterTotal: number
  images: ThirdPartyComicImageDto[]
  imageTotal: number
}

/** 第三方漫画图片进度详情，写入后台任务 progress.detail。 */
export type ThirdPartyComicImageImportProgressDetail = BackgroundTaskObject & {
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
export type RemoteImageImportSuccessPayload = BackgroundTaskObject & {
  image: ThirdPartyComicImageDto
  imageIndex: number
  imageTotal: number
  safeSourceUrl: string
  filePath: string
  deleteTarget: UploadDeleteTarget
  fileSize?: number
  mimeType?: string
}

/** 远程图片导入成功回调。 */
export type RemoteImageImportSuccessHandler = (
  payload: RemoteImageImportSuccessPayload,
) => Promise<void>

/** 远程图片导入失败上下文，只包含可安全落库的定位信息。 */
export type RemoteImageImportFailureContext = BackgroundTaskObject & {
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
