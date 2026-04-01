/**
 * 签到计划状态枚举。
 */
export enum CheckInPlanStatusEnum {
  /** 草稿 */
  DRAFT = 0,
  /** 已发布 */
  PUBLISHED = 1,
  /** 已下线 */
  OFFLINE = 2,
}

/**
 * 签到周期类型枚举。
 */
export enum CheckInCycleTypeEnum {
  /** 每日一期 */
  DAILY = 'daily',
  /** 按周切周期 */
  WEEKLY = 'weekly',
  /** 按月切周期 */
  MONTHLY = 'monthly',
}

/**
 * 签到事实类型枚举。
 */
export enum CheckInRecordTypeEnum {
  /** 正常签到 */
  NORMAL = 1,
  /** 补签 */
  MAKEUP = 2,
}

/**
 * 奖励状态枚举。
 */
export enum CheckInRewardStatusEnum {
  /** 待处理 */
  PENDING = 0,
  /** 已成功 */
  SUCCESS = 1,
  /** 已失败 */
  FAILED = 2,
}

/**
 * 奖励结果类型枚举。
 */
export enum CheckInRewardResultTypeEnum {
  /** 本次真实落账 */
  APPLIED = 1,
  /** 命中幂等，未重复落账 */
  IDEMPOTENT = 2,
  /** 本次处理失败 */
  FAILED = 3,
}

/**
 * 连续奖励规则状态枚举。
 */
export enum CheckInStreakRewardRuleStatusEnum {
  /** 已停用 */
  DISABLED = 0,
  /** 已启用 */
  ENABLED = 1,
}

/**
 * 签到操作来源枚举。
 */
export enum CheckInOperatorTypeEnum {
  /** 用户主动操作 */
  USER = 1,
  /** 管理员补偿或修复 */
  ADMIN = 2,
  /** 系统任务补偿 */
  SYSTEM = 3,
}

/**
 * 签到补偿目标类型枚举。
 */
export enum CheckInRepairTargetTypeEnum {
  /** 基础签到奖励 */
  RECORD_REWARD = 1,
  /** 连续签到奖励 */
  STREAK_GRANT = 2,
}

/**
 * 默认对账批量扫描上限。
 */
export const CHECK_IN_DEFAULT_REPAIR_SCAN_LIMIT = 100
