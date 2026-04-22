/** 补偿记录类型枚举。 */
export enum GrowthRewardSettlementTypeEnum {
  /** 通用成长事件的补偿记录。 */
  GROWTH_EVENT = 1,
  /** 任务奖励的补偿记录。 */
  TASK_REWARD = 2,
  /** 签到基础奖励的补偿记录。 */
  CHECK_IN_RECORD_REWARD = 3,
  /** 连续签到奖励的补偿记录。 */
  CHECK_IN_STREAK_REWARD = 4,
}

/** 补偿记录状态枚举。 */
export enum GrowthRewardSettlementStatusEnum {
  /** 待补偿重试。 */
  PENDING = 0,
  /** 已补偿成功。 */
  SUCCESS = 1,
  /** 终态失败，无需再次重试。 */
  TERMINAL = 2,
}

/** 补偿记录处理结果枚举。 */
export enum GrowthRewardSettlementResultTypeEnum {
  /** 本次处理真实落账。 */
  APPLIED = 1,
  /** 命中幂等，未重复落账。 */
  IDEMPOTENT = 2,
  /** 本次处理失败。 */
  FAILED = 3,
}

/** 补偿状态中文标签映射。 */
export const GrowthRewardSettlementStatusLabel: Record<
  GrowthRewardSettlementStatusEnum,
  string
> = {
  // 待补偿重试。
  [GrowthRewardSettlementStatusEnum.PENDING]: '待补偿重试',
  // 已补偿成功。
  [GrowthRewardSettlementStatusEnum.SUCCESS]: '已补偿成功',
  // 已进入终态失败。
  [GrowthRewardSettlementStatusEnum.TERMINAL]: '终态失败',
}

/** 补偿记录类型中文标签映射。 */
export const GrowthRewardSettlementTypeLabel: Record<
  GrowthRewardSettlementTypeEnum,
  string
> = {
  // 通用成长事件补偿记录。
  [GrowthRewardSettlementTypeEnum.GROWTH_EVENT]: '通用成长事件',
  // 任务奖励补偿记录。
  [GrowthRewardSettlementTypeEnum.TASK_REWARD]: '任务奖励',
  // 签到基础奖励补偿记录。
  [GrowthRewardSettlementTypeEnum.CHECK_IN_RECORD_REWARD]: '签到基础奖励',
  // 连续签到奖励补偿记录。
  [GrowthRewardSettlementTypeEnum.CHECK_IN_STREAK_REWARD]: '签到连续奖励',
}

/** 补偿结果中文标签映射。 */
export const GrowthRewardSettlementResultTypeLabel: Record<
  GrowthRewardSettlementResultTypeEnum,
  string
> = {
  // 本次真实落账。
  [GrowthRewardSettlementResultTypeEnum.APPLIED]: '本次真实落账',
  // 命中幂等，未重复落账。
  [GrowthRewardSettlementResultTypeEnum.IDEMPOTENT]: '命中幂等未重复落账',
  // 本次处理失败。
  [GrowthRewardSettlementResultTypeEnum.FAILED]: '本次处理失败',
}
