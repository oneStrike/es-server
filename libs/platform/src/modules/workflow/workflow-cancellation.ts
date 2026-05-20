import type { WorkflowCancellationErrorInput } from './workflow.type'

/** 工作流协作式取消请求信号，由业务 handler 转换为带计数的取消完成错误。 */
export class WorkflowCancellationSignal extends Error {
  constructor(message = '工作流任务已请求取消') {
    super(message)
    this.name = 'WorkflowCancellationSignal'
  }
}

/** 工作流协作式取消完成错误，必须携带 job 与 attempt 两套计数。 */
export class WorkflowCancellationError extends Error {
  readonly jobCounters: WorkflowCancellationErrorInput['jobCounters']
  readonly attemptCounters: WorkflowCancellationErrorInput['attemptCounters']

  // 初始化取消完成错误，保留已完成计数和底层原因。
  constructor(input: WorkflowCancellationErrorInput) {
    super(input.message ?? '工作流任务已请求取消')
    this.name = 'WorkflowCancellationError'
    this.jobCounters = input.jobCounters
    this.attemptCounters = input.attemptCounters
    if (input.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = input.cause
    }
  }
}

/** 判断异常是否为工作流取消信号。 */
export function isWorkflowCancellationError(
  error: unknown,
): error is WorkflowCancellationError | WorkflowCancellationSignal {
  return (
    error instanceof WorkflowCancellationError ||
    error instanceof WorkflowCancellationSignal
  )
}
