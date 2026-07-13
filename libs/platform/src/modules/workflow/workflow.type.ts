import type { DbTransaction } from '@db/core'
import type {
  WorkflowAttemptSelect,
  WorkflowEventSelect,
  WorkflowJobSelect,
} from '@db/schema'
import type {
  WorkflowItemDto,
  WorkflowItemPageRequestDto,
} from './dto/workflow.dto'
import type {
  WorkflowErrorCodeEnum,
  WorkflowErrorContext,
  WorkflowErrorDiagnosticInput,
  WorkflowErrorFacts,
  WorkflowErrorFactsInput,
} from './workflow-error-facts'
import type {
  WorkflowAttemptStatusEnum,
  WorkflowAttemptTriggerTypeEnum,
  WorkflowEventTypeEnum,
  WorkflowJobStatusEnum,
  WorkflowOperatorTypeEnum,
} from './workflow.constant'

/** 工作流开放 JSON 对象。 */
export type WorkflowObject = Record<string, unknown>

/** 工作流后台管理员操作者。 */
export interface WorkflowAdminOperator {
  type: WorkflowOperatorTypeEnum.ADMIN
  userId: number
}

/** 工作流系统操作者。 */
export interface WorkflowSystemOperator {
  type: WorkflowOperatorTypeEnum.SYSTEM
  userId?: null
}

/** 工作流操作者。 */
export type WorkflowOperator = WorkflowAdminOperator | WorkflowSystemOperator

/** 工作流进度快照。 */
export interface WorkflowProgress {
  code?: WorkflowErrorCodeEnum | string | null
  context?: WorkflowObject | null
  percent?: number
  detail?: WorkflowObject | null
  counters?: WorkflowJobCounterPatch
}

/** 工作流 job 当前读模型计数。 */
export interface WorkflowJobCounterPatch {
  successItemCount: number
  failedItemCount: number
  skippedItemCount: number
}

/** 工作流 attempt 局部计数。 */
export type WorkflowAttemptCounterPatch = WorkflowJobCounterPatch

/** 创建工作流任务入参。 */
export interface CreateWorkflowJobInput {
  workflowType: string
  displayName: string
  operator: WorkflowOperator
  status?: WorkflowJobStatusEnum
  progress?: WorkflowProgress
  selectedItemCount?: number
  summary?: WorkflowObject | null
  expiresAt?: Date | null
  conflictKeys?: string[]
}

/** 领域资源初始化入参。 */
export interface CreateWorkflowDraftResourceInitializerInput {
  tx: DbTransaction
  workflowJob: WorkflowJobSelect
}

/** 领域资源初始化函数。 */
export type CreateWorkflowDraftResourceInitializer = (
  input: CreateWorkflowDraftResourceInitializerInput,
) => Promise<void>

/** 工作流事件入参。 */
export interface AppendWorkflowEventInput {
  workflowJobId: bigint
  workflowAttemptId?: bigint | null
  eventType: WorkflowEventTypeEnum
  eventCode: string
  detail?: WorkflowObject | null
}

/** 工作流 attempt 完成入参。 */
export interface CompleteWorkflowAttemptInput {
  workflowAttemptId: bigint
  status: WorkflowAttemptStatusEnum
  jobCounters: WorkflowJobCounterPatch
  attemptCounters: WorkflowAttemptCounterPatch
  completionOwnerClaimedBy?: string
  error?: WorkflowErrorFacts | WorkflowErrorFactsInput | null
  errorDiagnostic?: WorkflowErrorDiagnosticInput | null
}

/** 完成当前 attempt 后延后再次执行的入参。 */
export interface CompleteWorkflowAttemptWithDelayedRetryInput extends CompleteWorkflowAttemptInput {
  nextRetryAt: Date
  delayedSelectedItemCount: number
}

/** 使用公开 attemptId 完成 attempt 的入参。 */
export type CompleteWorkflowAttemptByAttemptIdInput = Omit<
  CompleteWorkflowAttemptInput,
  'workflowAttemptId'
> & {
  attemptId: string
  completionOwnerClaimedBy: string
}

/** 使用公开 attemptId 完成当前 attempt 并创建延后 retry attempt 的入参。 */
export type CompleteWorkflowAttemptWithDelayedRetryByAttemptIdInput = Omit<
  CompleteWorkflowAttemptWithDelayedRetryInput,
  'workflowAttemptId'
> & {
  attemptId: string
  completionOwnerClaimedBy: string
}

/** 执行上下文完成当前 attempt 的入参。 */
export type CompleteCurrentWorkflowAttemptInput = Omit<
  CompleteWorkflowAttemptByAttemptIdInput,
  'attemptId' | 'completionOwnerClaimedBy'
>

/** 执行上下文完成当前 attempt 并创建延后 retry attempt 的入参。 */
export type CompleteCurrentWorkflowAttemptWithDelayedRetryInput = Omit<
  CompleteWorkflowAttemptWithDelayedRetryByAttemptIdInput,
  'attemptId' | 'completionOwnerClaimedBy'
>

/** 工作流执行上下文。 */
export interface WorkflowExecutionContext {
  jobId: string
  attemptId: string
  workflowType: string
  attemptNo: number
  getStatus: () => Promise<WorkflowJobStatusEnum>
  isCancelRequested: () => Promise<boolean>
  assertNotCancelled: () => Promise<void>
  assertStillOwned: () => Promise<void>
  completeAttempt: (input: CompleteCurrentWorkflowAttemptInput) => Promise<void>
  completeAttemptWithDelayedRetry: (
    input: CompleteCurrentWorkflowAttemptWithDelayedRetryInput,
  ) => Promise<void>
  updateProgress: (progress: WorkflowProgress) => Promise<void>
  appendEvent: (
    eventType: WorkflowEventTypeEnum,
    eventCode: string,
    detail?: WorkflowErrorContext,
  ) => Promise<bigint>
}

/** 工作流 execute 钩子入参。 */
export type WorkflowExecuteContext = WorkflowExecutionContext

/** 工作流人工重试上下文。 */
export interface WorkflowRetryContext {
  jobId: string
  workflowType: string
  selectedItemIds: string[]
  conflictKeys: string[]
}

/** 过期 RUNNING attempt 恢复上下文。 */
export interface WorkflowExpiredAttemptRecoveryContext {
  jobId: string
  workflowType: string
  expiredAttemptNo: number
  conflictKeys: string[]
}

/** 工作流通用条目分页上下文。 */
export interface WorkflowItemPageContext {
  jobId: string
  workflowType: string
  query: WorkflowItemPageRequestDto
}

/** 过期 RUNNING attempt 恢复结果。 */
export interface WorkflowExpiredAttemptRecoveryResult {
  selectedItemCount: number
  jobCounters: WorkflowJobCounterPatch
  attemptCounters: WorkflowAttemptCounterPatch
  recoverableItemCount: number
}

/** 由恢复计数解析终态时需要的最小计数字段。 */
export type WorkflowStatusCounters = Pick<
  WorkflowJobCounterPatch,
  'failedItemCount' | 'successItemCount'
>

/** 人工重试准备结果。 */
export interface WorkflowRetryPreparationResult {
  jobCounters: WorkflowJobCounterPatch
}

/** 工作流通知轮询查询只需要的事件投影字段。 */
export type WorkflowNotificationEventProjection = Pick<
  WorkflowEventSelect,
  'id' | 'eventType' | 'workflowAttemptId' | 'createdAt'
>

/** 工作流通知轮询查询只需要的任务投影字段。 */
export type WorkflowNotificationJobProjection = Pick<
  WorkflowJobSelect,
  | 'jobId'
  | 'workflowType'
  | 'displayName'
  | 'status'
  | 'currentAttemptFk'
  | 'selectedItemCount'
  | 'successItemCount'
  | 'failedItemCount'
  | 'skippedItemCount'
  | 'archivedAt'
  | 'updatedAt'
>

/** 工作流通知轮询查询只需要的 attempt 投影字段。 */
export type WorkflowNotificationAttemptProjection = Pick<
  WorkflowAttemptSelect,
  'triggerType' | 'notBeforeAt'
>

/** 工作流通知轮询 join 后的窄行结构，避免读取大 JSON 与诊断字段。 */
export interface WorkflowNotificationRow {
  attempt: WorkflowNotificationAttemptProjection
  event: WorkflowNotificationEventProjection
  job: WorkflowNotificationJobProjection
}

/** 工作流取消错误入参。 */
export interface WorkflowCancellationErrorInput {
  jobCounters: WorkflowJobCounterPatch
  attemptCounters: WorkflowAttemptCounterPatch
  cause?: unknown
  message?: string
}

/** 工作流处理器。 */
export interface WorkflowHandler {
  workflowType: string
  workflowLabel: string
  workflowDescription?: string
  workflowEnabled?: boolean
  execute: (context: WorkflowExecutionContext) => Promise<void>
  validateRetry?: (context: WorkflowRetryContext) => Promise<void>
  prepareRetry?: (
    context: WorkflowRetryContext,
    nextAttemptNo: number,
    tx: DbTransaction,
  ) => Promise<WorkflowRetryPreparationResult>
  recoverExpiredAttempt?: (
    context: WorkflowExpiredAttemptRecoveryContext,
    nextAttemptNo: number,
    tx: DbTransaction,
  ) => Promise<WorkflowExpiredAttemptRecoveryResult>
  getItemPage?: (context: WorkflowItemPageContext) => Promise<{
    list: WorkflowItemDto[]
    pageIndex: number
    pageSize: number
    total: number
  }>
  cleanupExpiredDrafts?: (jobId: string) => Promise<void>
  cleanupRetainedResources?: (jobId: string) => Promise<void>
}

/** 新建 attempt 结果。 */
export interface WorkflowAttemptCreationResult {
  id: bigint
  attemptId: string
  attemptNo: number
  triggerType: WorkflowAttemptTriggerTypeEnum
}

/** 构建 attempt completion WHERE 条件所需的输入字段子集。 */
export type AttemptCompletionWhereInput = Pick<
  CompleteWorkflowAttemptInput,
  'completionOwnerClaimedBy'
>
