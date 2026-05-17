import type { Db, DrizzleService } from '@db/core'
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
  percent?: number
  message?: string | null
}

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

/** 工作流事件入参。 */
export interface AppendWorkflowEventInput {
  workflowJobId: bigint
  workflowAttemptId?: bigint | null
  eventType: WorkflowEventTypeEnum
  message: string
  detail?: WorkflowObject | null
}

/** 工作流 attempt 完成入参。 */
export interface CompleteWorkflowAttemptInput {
  workflowAttemptId: bigint
  status: WorkflowAttemptStatusEnum
  successItemCount: number
  failedItemCount: number
  skippedItemCount: number
  errorCode?: string | null
  errorMessage?: string | null
}

/** 使用公开 attemptId 完成 attempt 的入参。 */
export type CompleteWorkflowAttemptByAttemptIdInput = Omit<
  CompleteWorkflowAttemptInput,
  'workflowAttemptId'
> & {
  attemptId: string
}

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
  updateProgress: (progress: WorkflowProgress) => Promise<void>
  appendEvent: (
    eventType: WorkflowEventTypeEnum,
    message: string,
    detail?: WorkflowObject,
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

/** 过期 RUNNING attempt 恢复结果。 */
export interface WorkflowExpiredAttemptRecoveryResult {
  selectedItemCount: number
  successItemCount: number
  failedItemCount: number
  skippedItemCount: number
  recoverableItemCount: number
}

/** 由恢复计数解析终态时需要的最小计数字段。 */
export type WorkflowStatusCounters = Pick<
  WorkflowExpiredAttemptRecoveryResult,
  'failedItemCount' | 'successItemCount'
>

/** 数据库错误处理文案映射类型。 */
export type WorkflowDatabaseErrorMessages = Parameters<
  DrizzleService['handleError']
>[1]

/** 工作流处理器。 */
export interface WorkflowHandler {
  workflowType: string
  execute: (context: WorkflowExecutionContext) => Promise<void>
  validateRetry?: (context: WorkflowRetryContext) => Promise<void>
  prepareRetry?: (
    context: WorkflowRetryContext,
    nextAttemptNo: number,
    tx: Db,
  ) => Promise<void>
  recoverExpiredAttempt?: (
    context: WorkflowExpiredAttemptRecoveryContext,
    nextAttemptNo: number,
    tx: Db,
  ) => Promise<WorkflowExpiredAttemptRecoveryResult>
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
