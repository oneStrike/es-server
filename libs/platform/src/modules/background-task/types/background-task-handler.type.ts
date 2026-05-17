import type { BackgroundTaskStatusEnum } from '../background-task.constant'

/** 后台任务 JSON 对象负载。 */
export type BackgroundTaskObject = Record<string, unknown>

/** 后台任务进度快照。 */
export interface BackgroundTaskProgress extends BackgroundTaskObject {
  percent?: number
  message?: string
  stage?: string
  unit?: string
  current?: number
  total?: number
  detail?: BackgroundTaskObject
}

/** 后台任务进度 reporter 的区间映射配置。 */
export interface BackgroundTaskProgressReporterOptions {
  startPercent?: number
  endPercent?: number
  total: number
  stage?: string
  unit?: string
  message?: string
  detail?: BackgroundTaskObject
}

/** 后台任务进度 reporter 单次推进参数。 */
export interface BackgroundTaskProgressReporterAdvanceInput {
  amount?: number
  current?: number
  message?: string
  detail?: BackgroundTaskObject
}

/** 后台任务进度 reporter，负责生成单调进度快照。 */
export interface BackgroundTaskProgressReporter {
  advance: (
    input?: BackgroundTaskProgressReporterAdvanceInput,
  ) => Promise<BackgroundTaskProgress>
}

/** 后台任务执行上下文。 */
export interface BackgroundTaskExecutionContext<
  TPayload extends BackgroundTaskObject = BackgroundTaskObject,
  TResidue extends BackgroundTaskObject = BackgroundTaskObject,
> {
  /** 对外任务 ID。 */
  taskId: string
  /** 任务类型。 */
  taskType: string
  /** 当前任务负载。 */
  payload: TPayload
  /** 读取最新任务状态。 */
  getStatus: () => Promise<BackgroundTaskStatusEnum>
  /** 检查是否已被请求取消。 */
  isCancelRequested: () => Promise<boolean>
  /** 已被请求取消时抛出协作取消异常。 */
  assertNotCancelled: () => Promise<void>
  /** 校验当前 worker 仍拥有任务 claim，不读取取消状态。 */
  assertStillOwned: () => Promise<void>
  /** 更新任务进度。 */
  updateProgress: (progress: BackgroundTaskProgress) => Promise<void>
  /** 创建区间进度 reporter，用于业务按稳定单位推进任务进度。 */
  createProgressReporter: (
    options: BackgroundTaskProgressReporterOptions,
  ) => BackgroundTaskProgressReporter
  /** 合并记录可回滚残留。 */
  recordResidue: (residue: Partial<TResidue>) => Promise<void>
  /** 读取已记录的可回滚残留。 */
  getResidue: () => Promise<TResidue>
}

/** 后台任务重试前校验上下文。 */
export interface BackgroundTaskRetryValidationContext<
  TPayload extends BackgroundTaskObject = BackgroundTaskObject,
  TResidue extends BackgroundTaskObject = BackgroundTaskObject,
> {
  /** 对外任务 ID。 */
  taskId: string
  /** 任务类型。 */
  taskType: string
  /** 当前任务负载。 */
  payload: TPayload
  /** 处理器记录的待回滚残留。 */
  residue: TResidue
  /** 当前任务状态。 */
  status: BackgroundTaskStatusEnum
  /** 已重试次数。 */
  retryCount: number
  /** 创建任务时持久化的去重键。 */
  dedupeKey: string | null
  /** 创建任务时持久化的串行键。 */
  serialKey: string | null
  /** 创建任务时持久化的业务冲突键。 */
  conflictKeys: string[]
}

/** 后台任务处理器。 */
export interface BackgroundTaskHandler<
  TPayload extends BackgroundTaskObject = BackgroundTaskObject,
  TPrepared = unknown,
  TResult extends BackgroundTaskObject = BackgroundTaskObject,
  TResidue extends BackgroundTaskObject = BackgroundTaskObject,
> {
  /** 处理器唯一任务类型。 */
  taskType: string
  /** 重试前校验，用于拒绝缺少新版 reservation snapshot 的历史任务。 */
  validateRetry?: (
    context: BackgroundTaskRetryValidationContext<TPayload, TResidue>,
  ) => Promise<void>
  /** 准备阶段，严禁产生不可清理的最终业务副作用。 */
  prepare?: (
    context: BackgroundTaskExecutionContext<TPayload, TResidue>,
  ) => Promise<TPrepared>
  /** 最终写入阶段，服务会在调用前把任务推进到 FINALIZING。 */
  finalize: (
    context: BackgroundTaskExecutionContext<TPayload, TResidue>,
    prepared: TPrepared,
  ) => Promise<TResult>
  /** 失败或取消后的补偿清理。 */
  rollback: (
    context: BackgroundTaskExecutionContext<TPayload, TResidue>,
    error: unknown,
  ) => Promise<void>
}
