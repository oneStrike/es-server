import type {
  WorkflowCancellationCounters,
  WorkflowCancellationErrorInput,
} from './workflow.type'

/** 工作流协作式取消信号。 */
export class WorkflowCancellationError extends Error {
  readonly counters?: WorkflowCancellationCounters

  // 初始化取消信号，保留已完成计数和底层原因。
  constructor(input: WorkflowCancellationErrorInput = {}) {
    super(input.message ?? '工作流任务已请求取消')
    this.name = 'WorkflowCancellationError'
    this.counters = input.counters
    if (input.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = input.cause
    }
  }
}

/** 判断异常是否为工作流取消信号。 */
export function isWorkflowCancellationError(
  error: unknown,
): error is WorkflowCancellationError {
  return error instanceof WorkflowCancellationError
}
