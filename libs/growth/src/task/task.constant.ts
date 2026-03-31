/**
 * 任务场景类型枚举。
 *
 * 注意：
 * - 周期语义统一由 `repeatRule` 表达；
 * - 历史库中的 `REPEAT(3)`、`OPERATION(5)` 会在读取与筛选时兼容映射；
 * - 新写入只允许稳定场景值。
 */
export enum TaskTypeEnum {
  /** 新手引导任务 */
  ONBOARDING = 1,
  /** 日常任务 */
  DAILY = 2,
  /** 活动/运营任务 */
  CAMPAIGN = 4,
}

/**
 * 任务目标类型枚举。
 */
export enum TaskObjectiveTypeEnum {
  /** 手动推进或人工确认 */
  MANUAL = 1,
  /** 由业务事件累计次数驱动 */
  EVENT_COUNT = 2,
}

const LEGACY_TASK_TYPE_NORMALIZED_MAP = {
  1: TaskTypeEnum.ONBOARDING,
  2: TaskTypeEnum.DAILY,
  3: TaskTypeEnum.DAILY,
  4: TaskTypeEnum.CAMPAIGN,
  5: TaskTypeEnum.CAMPAIGN,
} as const satisfies Record<number, TaskTypeEnum>

const TASK_TYPE_FILTER_VALUES = {
  [TaskTypeEnum.ONBOARDING]: [TaskTypeEnum.ONBOARDING],
  [TaskTypeEnum.DAILY]: [TaskTypeEnum.DAILY, 3],
  [TaskTypeEnum.CAMPAIGN]: [TaskTypeEnum.CAMPAIGN, 5],
} as const satisfies Record<TaskTypeEnum, readonly number[]>

/**
 * 归一化任务场景类型。
 *
 * 旧值兼容关系：
 * - `3(REPEAT)` -> `DAILY`
 * - `5(OPERATION)` -> `CAMPAIGN`
 */
export function normalizeTaskType(type: number | null | undefined) {
  if (type === null || type === undefined) {
    return TaskTypeEnum.ONBOARDING
  }
  return LEGACY_TASK_TYPE_NORMALIZED_MAP[type] ?? TaskTypeEnum.ONBOARDING
}

/**
 * 获取任务场景筛选所需的兼容值集合。
 */
export function getTaskTypeFilterValues(type: TaskTypeEnum) {
  return [...TASK_TYPE_FILTER_VALUES[type]]
}

/**
 * 归一化任务目标类型。
 */
export function normalizeTaskObjectiveType(
  type: number | null | undefined,
) {
  if (type === TaskObjectiveTypeEnum.EVENT_COUNT) {
    return TaskObjectiveTypeEnum.EVENT_COUNT
  }
  return TaskObjectiveTypeEnum.MANUAL
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
  /** 已领取待开始 */
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
 * 用户侧任务卡片可见状态枚举。
 *
 * 用于统一 App 任务列表、任务通知和后台 assignment 观察面的状态口径，
 * 避免把内部 assignment/reward 状态直接暴露给用户端。
 */
export enum TaskUserVisibleStatusEnum {
  /** 当前用户可直接领取 */
  CLAIMABLE = 'claimable',
  /** 已领取但尚未开始 */
  CLAIMED = 'claimed',
  /** 已开始推进 */
  IN_PROGRESS = 'in_progress',
  /** 已完成且无额外奖励待展示 */
  COMPLETED = 'completed',
  /** 已完成但奖励仍待补偿/重试 */
  REWARD_PENDING = 'reward_pending',
  /** 任务 bonus 已成功到账 */
  REWARD_GRANTED = 'reward_granted',
  /** assignment 已过期 */
  EXPIRED = 'expired',
  /** 当前记录对用户已不可用，仅保留审计可见性 */
  UNAVAILABLE = 'unavailable',
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
 * 任务进度来源枚举
 */
export enum TaskProgressSourceEnum {
  /** 用户主动领取/上报/完成 */
  MANUAL = 1,
  /** 业务事件驱动推进 */
  EVENT = 2,
  /** 系统定时或自动分配补写 */
  SYSTEM = 3,
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
