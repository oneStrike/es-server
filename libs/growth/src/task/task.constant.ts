/**
 * 任务类型枚举
 */
export enum TaskTypeEnum {
  /** 新手任务 */
  NEWBIE = 1,
  /** 日常任务 */
  DAILY = 2,
  /** 重复任务 */
  REPEAT = 3,
  /** 活动任务 */
  ACTIVITY = 4,
  /** 运营任务 */
  OPERATION = 5,
}

/**
 * 任务状态枚举
 */
export enum TaskStatusEnum {
  /** 草稿 */
  DRAFT = 0,
  /** 已发布 */
  PUBLISHED = 1,
  /** 已下线 */
  OFFLINE = 2,
}

/**
 * 任务领取模式枚举
 */
export enum TaskClaimModeEnum {
  /** 自动领取 */
  AUTO = 1,
  /** 手动领取 */
  MANUAL = 2,
}

/**
 * 任务完成模式枚举
 */
export enum TaskCompleteModeEnum {
  /** 自动完成 */
  AUTO = 1,
  /** 手动完成 */
  MANUAL = 2,
}

/**
 * 任务分配状态枚举
 */
export enum TaskAssignmentStatusEnum {
  /** 待领取 */
  PENDING = 0,
  /** 进行中 */
  IN_PROGRESS = 1,
  /** 已完成 */
  COMPLETED = 2,
  /** 已过期 */
  EXPIRED = 3,
}

/**
 * 任务奖励结算状态枚举
 */
export enum TaskAssignmentRewardStatusEnum {
  /** 待结算 */
  PENDING = 0,
  /** 已结算成功 */
  SUCCESS = 1,
  /** 结算失败 */
  FAILED = 2,
}

/**
 * 任务奖励结算结果类型枚举
 */
export enum TaskAssignmentRewardResultTypeEnum {
  /** 本次真实落账 */
  APPLIED = 1,
  /** 命中幂等，未重复落账 */
  IDEMPOTENT = 2,
  /** 本次结算失败 */
  FAILED = 3,
}

/**
 * 任务进度动作类型枚举
 */
export enum TaskProgressActionTypeEnum {
  /** 领取 */
  CLAIM = 1,
  /** 上报进度 */
  PROGRESS = 2,
  /** 完成 */
  COMPLETE = 3,
  /** 过期 */
  EXPIRE = 4,
}

/**
 * 任务重复类型枚举
 */
export enum TaskRepeatTypeEnum {
  /** 一次性 */
  ONCE = 'once',
  /** 每日 */
  DAILY = 'daily',
  /** 每周 */
  WEEKLY = 'weekly',
  /** 每月 */
  MONTHLY = 'monthly',
}

/**
 * 任务提醒类型枚举
 */
export enum TaskReminderKindEnum {
  /** 新任务可领 */
  AVAILABLE = 'task_available',
  /** 任务即将过期 */
  EXPIRING_SOON = 'task_expiring_soon',
  /** 奖励到账 */
  REWARD_GRANTED = 'task_reward_granted',
}

export const TASK_COMPLETE_EVENT_CODE = 'task.complete'
export const TASK_COMPLETE_EVENT_KEY = 'TASK_COMPLETE'

/** 新任务提醒默认只覆盖最近 24 小时进入可领取状态的任务 */
export const TASK_AVAILABLE_REMINDER_RECENT_HOURS = 24
/** 即将过期提醒窗口，默认在过期前 24 小时内触发 */
export const TASK_EXPIRING_SOON_REMINDER_HOURS = 24
