/** 补签周期类型枚举。 */
export enum CheckInMakeupPeriodTypeEnum {
  /** 按自然周发放系统补签额度。 */
  WEEKLY = 1,
  /** 按自然月发放系统补签额度。 */
  MONTHLY = 2,
}

/** 周期模式奖励规则类型枚举。 */
export enum CheckInPatternRewardRuleTypeEnum {
  /** 按周固定星期几。 */
  WEEKDAY = 1,
  /** 按月固定日期。 */
  MONTH_DAY = 2,
  /** 按月最后一天。 */
  MONTH_LAST_DAY = 3,
}

/** 签到事实类型枚举。 */
export enum CheckInRecordTypeEnum {
  /** 正常签到。 */
  NORMAL = 1,
  /** 补签。 */
  MAKEUP = 2,
}

/** 奖励结果类型枚举。 */
export enum CheckInRewardResultTypeEnum {
  /** 本次真实落账。 */
  APPLIED = 1,
  /** 命中幂等，未重复落账。 */
  IDEMPOTENT = 2,
  /** 本次处理失败。 */
  FAILED = 3,
}

/** 基础奖励解析来源枚举。 */
export enum CheckInRewardSourceTypeEnum {
  /** 命中默认基础奖励。 */
  BASE_REWARD = 1,
  /** 命中具体日期奖励。 */
  DATE_RULE = 2,
  /** 命中周期模式奖励。 */
  PATTERN_RULE = 3,
}

/** 连续奖励规则状态枚举。 */
export enum CheckInStreakRewardRuleStatusEnum {
  /** 已停用。 */
  DISABLED = 0,
  /** 已启用。 */
  ENABLED = 1,
}

/** 连续奖励轮次状态枚举。 */
export enum CheckInStreakRoundStatusEnum {
  /** 草稿。 */
  DRAFT = 0,
  /** 已启用。 */
  ACTIVE = 1,
  /** 已归档。 */
  ARCHIVED = 2,
}

/** 下一轮切换策略枚举。 */
export enum CheckInStreakNextRoundStrategyEnum {
  /** 沿用当前轮规则复制新版本。 */
  INHERIT = 1,
  /** 切换到显式指定的下一轮。 */
  EXPLICIT_NEXT = 2,
}

/** 补签额度事实类型枚举。 */
export enum CheckInMakeupFactTypeEnum {
  /** 发放额度。 */
  GRANT = 1,
  /** 消费额度。 */
  CONSUME = 2,
  /** 过期作废。 */
  EXPIRE = 3,
}

/** 补签额度来源类型枚举。 */
export enum CheckInMakeupSourceTypeEnum {
  /** 系统周期发放额度。 */
  PERIODIC_ALLOWANCE = 1,
  /** 活动补签卡。 */
  EVENT_CARD = 2,
  /** 管理员调整。 */
  ADMIN_ADJUSTMENT = 3,
}

/** 签到操作来源枚举。 */
export enum CheckInOperatorTypeEnum {
  /** 用户主动操作。 */
  USER = 1,
  /** 管理员补偿或修复。 */
  ADMIN = 2,
  /** 系统任务补偿。 */
  SYSTEM = 3,
}

/** 签到补偿目标类型枚举。 */
export enum CheckInRepairTargetTypeEnum {
  /** 基础签到奖励。 */
  RECORD_REWARD = 1,
  /** 连续签到奖励。 */
  STREAK_GRANT = 2,
}
