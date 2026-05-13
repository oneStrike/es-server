import type { BackgroundTaskStatusEnum } from '../background-task.constant'

/** 后台任务 JSON 对象负载。 */
export type BackgroundTaskObject = Record<string, unknown>

/** 后台任务进度快照。 */
export interface BackgroundTaskProgress extends BackgroundTaskObject {
  percent?: number
  message?: string
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
  /** 更新任务进度。 */
  updateProgress: (progress: BackgroundTaskProgress) => Promise<void>
  /** 合并记录可回滚残留。 */
  recordResidue: (residue: Partial<TResidue>) => Promise<void>
  /** 读取已记录的可回滚残留。 */
  getResidue: () => Promise<TResidue>
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
