/**
 * 任务系统常量定义
 */
export enum TaskTypeEnum {
  /** 新手任务 */
  NEWBIE = 1,
  /** 日常任务 */
  DAILY = 2,
  /** 可重复任务 */
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
 * 任务指派状态枚举
 */
export enum TaskAssignmentStatusEnum {
  /** 待开始 */
  PENDING = 0,
  /** 进行中 */
  IN_PROGRESS = 1,
  /** 已完成 */
  COMPLETED = 2,
  /** 已过期 */
  EXPIRED = 3,
}

/**
 * 任务进度动作枚举
 */
export enum TaskProgressActionTypeEnum {
  /** 领取 */
  CLAIM = 1,
  /** 进度更新 */
  PROGRESS = 2,
  /** 完成 */
  COMPLETE = 3,
  /** 过期 */
  EXPIRE = 4,
}

/**
 * 任务重复周期枚举
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
 * 任务成长事件 Key 映射
 */
export const TaskGrowthEventKey = {
  /** 任务完成 */
  COMPLETE: 'task.complete',
} as const

export type TaskGrowthEventKeyType =
  (typeof TaskGrowthEventKey)[keyof typeof TaskGrowthEventKey]
