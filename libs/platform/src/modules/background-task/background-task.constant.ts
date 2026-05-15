/** 后台任务默认最大重试次数。 */
export const BACKGROUND_TASK_DEFAULT_MAX_RETRY = 3

/** 后台任务 claim 默认有效秒数。 */
export const BACKGROUND_TASK_CLAIM_TIMEOUT_SECONDS = 300

/** 单轮 worker 最多消费任务数。 */
export const BACKGROUND_TASK_WORKER_BATCH_SIZE = 20

/** 后台任务默认等待进度。 */
export const BACKGROUND_TASK_INITIAL_PROGRESS = {
  percent: 0,
  message: '等待执行',
} as const

/** 后台任务操作者类型。 */
export enum BackgroundTaskOperatorTypeEnum {
  /** 后台管理员。 */
  ADMIN = 1,
  /** 系统任务。 */
  SYSTEM = 2,
}

/** 通用后台任务状态。 */
export enum BackgroundTaskStatusEnum {
  /** 待处理。 */
  PENDING = 1,
  /** 处理中。 */
  PROCESSING = 2,
  /** 最终写入中。 */
  FINALIZING = 3,
  /** 成功。 */
  SUCCESS = 4,
  /** 失败且已完成清理。 */
  FAILED = 5,
  /** 已取消且已完成清理。 */
  CANCELLED = 6,
  /** 失败或取消后的回滚清理失败。 */
  ROLLBACK_FAILED = 7,
}

/** 允许人工重试的清洁终态。 */
export const BACKGROUND_TASK_RETRYABLE_STATUSES = [
  BackgroundTaskStatusEnum.FAILED,
  BackgroundTaskStatusEnum.CANCELLED,
] as const

/** 不再由 worker 继续消费的终态。 */
export const BACKGROUND_TASK_TERMINAL_STATUSES = [
  BackgroundTaskStatusEnum.SUCCESS,
  BackgroundTaskStatusEnum.FAILED,
  BackgroundTaskStatusEnum.CANCELLED,
  BackgroundTaskStatusEnum.ROLLBACK_FAILED,
] as const
