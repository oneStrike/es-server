/** 工作流默认 claim 有效秒数。 */
export const WORKFLOW_CLAIM_TIMEOUT_SECONDS = 300

/** 工作流 worker 单轮最多消费 attempt 数。 */
export const WORKFLOW_WORKER_BATCH_SIZE = 20

/** 工作流操作者类型。 */
export enum WorkflowOperatorTypeEnum {
  /** 后台管理员。 */
  ADMIN = 1,
  /** 系统。 */
  SYSTEM = 2,
}

/** 工作流任务状态。 */
export enum WorkflowJobStatusEnum {
  /** 草稿。 */
  DRAFT = 1,
  /** 待处理。 */
  PENDING = 2,
  /** 处理中。 */
  RUNNING = 3,
  /** 成功。 */
  SUCCESS = 4,
  /** 部分失败。 */
  PARTIAL_FAILED = 5,
  /** 失败。 */
  FAILED = 6,
  /** 已取消。 */
  CANCELLED = 7,
  /** 已过期。 */
  EXPIRED = 8,
}

/** 工作流 attempt 状态。 */
export enum WorkflowAttemptStatusEnum {
  /** 待处理。 */
  PENDING = 1,
  /** 处理中。 */
  RUNNING = 2,
  /** 成功。 */
  SUCCESS = 3,
  /** 部分失败。 */
  PARTIAL_FAILED = 4,
  /** 失败。 */
  FAILED = 5,
  /** 已取消。 */
  CANCELLED = 6,
}

/** 工作流 attempt 触发类型。 */
export enum WorkflowAttemptTriggerTypeEnum {
  /** 首次确认。 */
  INITIAL_CONFIRM = 1,
  /** 人工重试。 */
  MANUAL_RETRY = 2,
  /** 系统恢复。 */
  SYSTEM_RECOVERY = 3,
}

/** 工作流事件类型。 */
export enum WorkflowEventTypeEnum {
  /** 创建草稿。 */
  JOB_CREATED = 1,
  /** 确认任务。 */
  JOB_CONFIRMED = 2,
  /** claim attempt。 */
  ATTEMPT_CLAIMED = 3,
  /** 心跳。 */
  HEARTBEAT = 4,
  /** 进度更新。 */
  PROGRESS_UPDATED = 5,
  /** 条目成功。 */
  ITEM_SUCCEEDED = 6,
  /** 条目失败。 */
  ITEM_FAILED = 7,
  /** attempt 完成。 */
  ATTEMPT_COMPLETED = 8,
  /** 请求取消。 */
  CANCEL_REQUESTED = 9,
  /** 人工重试。 */
  RETRY_REQUESTED = 10,
  /** 草稿过期。 */
  DRAFT_EXPIRED = 11,
  /** 资源清理。 */
  CLEANUP_RECORDED = 12,
}

/** 工作流可重试任务终态。 */
export const WORKFLOW_RETRYABLE_JOB_STATUSES = [
  WorkflowJobStatusEnum.PARTIAL_FAILED,
  WorkflowJobStatusEnum.FAILED,
] as const

/** 工作流任务终态。 */
export const WORKFLOW_TERMINAL_JOB_STATUSES = [
  WorkflowJobStatusEnum.SUCCESS,
  WorkflowJobStatusEnum.PARTIAL_FAILED,
  WorkflowJobStatusEnum.FAILED,
  WorkflowJobStatusEnum.CANCELLED,
  WorkflowJobStatusEnum.EXPIRED,
] as const

/** 工作流 attempt 终态。 */
export const WORKFLOW_TERMINAL_ATTEMPT_STATUSES = [
  WorkflowAttemptStatusEnum.SUCCESS,
  WorkflowAttemptStatusEnum.PARTIAL_FAILED,
  WorkflowAttemptStatusEnum.FAILED,
  WorkflowAttemptStatusEnum.CANCELLED,
] as const
