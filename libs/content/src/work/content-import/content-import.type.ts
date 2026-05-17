import type { Db } from '@db/core'
import type { ContentImportItemSelect } from '@db/schema'
import type {
  ThirdPartyComicImportChapterItemDto,
  ThirdPartyComicImportRequestDto,
  ThirdPartyComicSyncLatestRequestDto,
} from '@libs/content/work/content/dto/content.dto'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'

/** 创建三方导入领域任务入参。 */
export interface CreateThirdPartyImportContentJobInput {
  jobId: string
  dto: ThirdPartyComicImportRequestDto
}

/** 创建三方同步领域任务入参。 */
export interface CreateThirdPartySyncContentJobInput {
  jobId: string
  dto: ThirdPartyComicSyncLatestRequestDto
  source: {
    workId: number
    platform: string
    providerComicId: string
    providerPathWord: string
    providerGroupPathWord: string
    sourceBindingId: number
    sourceScopeKey: string
  }
}

/** 可执行内容导入条目。 */
export interface ContentImportExecutableItem extends ContentImportItemSelect {
  metadata: Record<string, unknown> | null
}

/** 三方导入章节元数据。 */
export interface ThirdPartyImportChapterItemMetadata {
  chapter: ThirdPartyComicImportChapterItemDto
}

/** 内容导入执行统计。 */
export interface ContentImportAttemptCounters {
  selectedItemCount: number
  successItemCount: number
  failedItemCount: number
  skippedItemCount: number
}

/** 标记内容导入条目成功的内部入参。 */
export interface ContentImportMarkItemSuccessInput {
  itemId: string
  attemptNo: number
  localChapterId?: number | null
  imageTotal?: number
  imageSuccessCount?: number
}

/** 标记内容导入条目失败的内部入参。 */
export interface ContentImportMarkItemFailedInput {
  itemId: string
  attemptNo: number
  errorCode: string
  errorMessage: string
  imageTotal?: number
  imageSuccessCount?: number
}

/** 记录已上传文件残留的内部入参。 */
export interface ContentImportRecordUploadedFileResidueInput {
  attemptId?: string
  deleteTarget: UploadDeleteTarget
  itemId?: string
  jobId: string
}

/** 内容导入事务回调。 */
export type ContentImportTransaction = Db
