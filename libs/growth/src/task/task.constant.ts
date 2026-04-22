/**
 * 任务场景类型枚举。
 *
 * 注意：
 * - 周期语义统一由 `repeatRule` 表达；
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

// 归一化任务场景类型，兜底到新手引导场景。
export function normalizeTaskType(type: number | null | undefined) {
  if (type === null || type === undefined) {
    return TaskTypeEnum.ONBOARDING
  }
  if (
    type === TaskTypeEnum.ONBOARDING ||
    type === TaskTypeEnum.DAILY ||
    type === TaskTypeEnum.CAMPAIGN
  ) {
    return type
  }
  return TaskTypeEnum.ONBOARDING
}

/**
 * 任务奖励结算结果类型枚举。
 */
export enum TaskRewardSettlementResultTypeEnum {
  /** 本次真实落账 */
  APPLIED = 1,
  /** 命中幂等，未重复落账 */
  IDEMPOTENT = 2,
  /** 本次结算失败 */
  FAILED = 3,
}

/**
 * 任务领取方式枚举。
 */
export enum TaskClaimModeEnum {
  /** 系统自动创建任务实例。 */
  AUTO = 1,
  /** 需要用户手动领取任务。 */
  MANUAL = 2,
}

/**
 * 任务提醒类型枚举。
 */
export enum TaskReminderKindEnum {
  /** 自动分配的新任务 */
  AUTO_ASSIGNED = 'task_auto_assigned',
  /** 任务即将过期 */
  EXPIRING_SOON = 'task_expiring_soon',
  /** 奖励到账 */
  REWARD_GRANTED = 'task_reward_granted',
}

/** 任务完成事件编码，供奖励结算链路复用。 */
export const TASK_COMPLETE_EVENT_CODE = 'task.complete'
/** 任务完成事件稳定键，供奖励结算链路复用。 */
export const TASK_COMPLETE_EVENT_KEY = 'TASK_COMPLETE'

/** 即将过期提醒窗口，默认在过期前 24 小时内触发 */
export const TASK_EXPIRING_SOON_REMINDER_HOURS = 24

/**
 * 新任务模型中的任务头状态枚举。
 */
export enum TaskDefinitionStatusEnum {
  /** 草稿，尚未生效。 */
  DRAFT = 0,
  /** 生效中，允许命中新实例。 */
  ACTIVE = 1,
  /** 已暂停，暂不接受新的推进。 */
  PAUSED = 2,
  /** 已归档，仅保留历史审计价值。 */
  ARCHIVED = 3,
}

/**
 * 新任务模型中的完成聚合策略枚举。
 */
export enum TaskCompletionPolicyEnum {
  /** 所有步骤完成后任务完成。 */
  ALL_STEPS = 1,
}

/**
 * 新任务模型中的重复周期枚举。
 */
export enum TaskRepeatCycleEnum {
  /** 一次性任务。 */
  ONCE = 0,
  /** 每日任务。 */
  DAILY = 1,
  /** 每周任务。 */
  WEEKLY = 2,
  /** 每月任务。 */
  MONTHLY = 3,
}

/**
 * 新任务模型中的步骤触发方式枚举。
 */
export enum TaskStepTriggerModeEnum {
  /** 由用户手动操作触发。 */
  MANUAL = 1,
  /** 由业务事件驱动触发。 */
  EVENT = 2,
}

/**
 * 新任务模型中的步骤进度模式枚举。
 */
export enum TaskStepProgressModeEnum {
  /** 首次命中即完成。 */
  ONCE = 1,
  /** 每次命中都累计。 */
  COUNT = 2,
  /** 只有命中新对象才累计。 */
  UNIQUE_COUNT = 3,
}

/**
 * 新任务模型中的唯一计数范围枚举。
 */
export enum TaskStepDedupeScopeEnum {
  /** 同一对象在当前周期内只计算一次。 */
  CYCLE = 1,
  /** 同一对象在所有周期内只计算一次。 */
  LIFETIME = 2,
}

/**
 * 新任务模型中的实例状态枚举。
 */
export enum TaskInstanceStatusEnum {
  /** 已领取但尚未开始。 */
  PENDING = 0,
  /** 已开始推进。 */
  IN_PROGRESS = 1,
  /** 已完成。 */
  COMPLETED = 2,
  /** 已过期。 */
  EXPIRED = 3,
}

/**
 * 新任务模型中的事件日志动作类型枚举。
 */
export enum TaskEventActionTypeEnum {
  /** 创建或领取实例。 */
  CLAIM = 1,
  /** 推进步骤进度。 */
  PROGRESS = 2,
  /** 标记任务或步骤完成。 */
  COMPLETE = 3,
  /** 标记任务或步骤过期。 */
  EXPIRE = 4,
  /** 记录一次拒绝命中。 */
  REJECT = 5,
}

/**
 * 新任务模型中的进度来源枚举。
 */
export enum TaskEventProgressSourceEnum {
  /** 由用户手动触发。 */
  MANUAL = 1,
  /** 由业务事件驱动。 */
  EVENT = 2,
  /** 由系统定时或补偿链路触发。 */
  SYSTEM = 3,
}

/**
 * 新任务模型中的用户可见状态枚举。
 */
export enum TaskVisibleStatusEnum {
  /** 当前用户可以直接领取。 */
  CLAIMABLE = 'claimable',
  /** 已领取但尚未开始。 */
  CLAIMED = 'claimed',
  /** 已开始推进。 */
  IN_PROGRESS = 'in_progress',
  /** 已完成且无额外奖励待展示。 */
  COMPLETED = 'completed',
  /** 已完成但奖励仍待补偿。 */
  REWARD_PENDING = 'reward_pending',
  /** 奖励已到账。 */
  REWARD_GRANTED = 'reward_granted',
  /** 已过期。 */
  EXPIRED = 'expired',
  /** 对当前用户不可用。 */
  UNAVAILABLE = 'unavailable',
}
