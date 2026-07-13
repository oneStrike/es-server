import type { ContentImportItemSelect } from '@db/schema'
import type { ThirdPartyComicSyncLatestRequestDto } from '@libs/content/work/content/dto/content.dto'
import type {
  HydratedThirdPartyComicImportChapterItem,
  HydratedThirdPartyComicImportRequest,
} from '@libs/content/work/third-party/third-party-comic-import.type'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'
import type {
  WorkflowErrorDiagnosticInput,
  WorkflowErrorFacts,
  WorkflowErrorFactsInput,
} from '@libs/platform/modules/workflow/workflow-error-facts'

/** 创建三方导入领域任务入参。 */
export interface CreateThirdPartyImportContentJobInput {
  jobId: string
  dto: HydratedThirdPartyComicImportRequest
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
export type ContentImportExecutableItem = Pick<
  ContentImportItemSelect,
  | 'autoRetryCount'
  | 'itemId'
  | 'maxAutoRetries'
  | 'metadata'
  | 'providerChapterId'
>

/** 三方导入章节元数据。 */
export interface ThirdPartyImportChapterItemMetadata {
  chapter: HydratedThirdPartyComicImportChapterItem
}

/** 内容导入执行统计。 */
export interface ContentImportAttemptCounters {
  selectedItemCount: number
  successItemCount: number
  failedItemCount: number
  skippedItemCount: number
  imageTotal: number
  imageSuccessCount: number
  imageFailedCount: number
}

/** 标记内容导入条目图片进度的内部入参。 */
export interface ContentImportMarkItemImageProgressInput {
  itemId: string
  imageTotal: number
  imageSuccessCount: number
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
  error: WorkflowErrorFacts | WorkflowErrorFactsInput
  errorDiagnostic?: WorkflowErrorDiagnosticInput | null
  imageTotal?: number
  imageSuccessCount?: number
}

/** 三方导入执行期已准备好的本地目标。 */
export interface ContentImportPreparedThirdPartyImportTargetInput {
  jobId: string
  workId: number
}

/** 标记内容导入条目等待限流自动重试的内部入参。 */
export interface ContentImportMarkItemRateLimitRetryingInput {
  itemId: string
  attemptNo: number
  nextRetryAt: Date
  error: WorkflowErrorFacts | WorkflowErrorFactsInput
  errorDiagnostic?: WorkflowErrorDiagnosticInput | null
  imageTotal?: number
  imageSuccessCount?: number
}

/** 标记内容导入条目自动重试耗尽的内部入参。 */
export interface ContentImportMarkItemRetryExhaustedInput {
  itemId: string
  attemptNo: number
  error?: WorkflowErrorFacts | WorkflowErrorFactsInput
  errorDiagnostic?: WorkflowErrorDiagnosticInput | null
  imageTotal?: number
  imageSuccessCount?: number
}

/** 内容导入执行统计，包含未来自动重试状态。 */
export interface ContentImportAttemptCountersWithRetry extends ContentImportAttemptCounters {
  futureRetryItemCount: number
  nextRetryAt: Date | null
}

/** 记录已上传文件残留的内部入参。 */
export interface ContentImportRecordUploadedFileResidueInput {
  attemptId?: string
  deleteTarget: UploadDeleteTarget
  itemId?: string
  jobId: string
}
