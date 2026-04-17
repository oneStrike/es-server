export enum GrowthRewardSettlementTypeEnum {
  GROWTH_EVENT = 1,
  TASK_REWARD = 2,
  CHECK_IN_RECORD_REWARD = 3,
  CHECK_IN_STREAK_REWARD = 4,
}

export enum GrowthRewardSettlementStatusEnum {
  PENDING = 0,
  SUCCESS = 1,
  TERMINAL = 2,
}

export enum GrowthRewardSettlementResultTypeEnum {
  APPLIED = 1,
  IDEMPOTENT = 2,
  FAILED = 3,
}

export const GrowthRewardSettlementStatusLabel: Record<
  GrowthRewardSettlementStatusEnum,
  string
> = {
  [GrowthRewardSettlementStatusEnum.PENDING]: '待补偿重试',
  [GrowthRewardSettlementStatusEnum.SUCCESS]: '已补偿成功',
  [GrowthRewardSettlementStatusEnum.TERMINAL]: '终态失败',
}

export const GrowthRewardSettlementTypeLabel: Record<
  GrowthRewardSettlementTypeEnum,
  string
> = {
  [GrowthRewardSettlementTypeEnum.GROWTH_EVENT]: '通用成长事件',
  [GrowthRewardSettlementTypeEnum.TASK_REWARD]: '任务奖励',
  [GrowthRewardSettlementTypeEnum.CHECK_IN_RECORD_REWARD]: '签到基础奖励',
  [GrowthRewardSettlementTypeEnum.CHECK_IN_STREAK_REWARD]: '签到连续奖励',
}

export const GrowthRewardSettlementResultTypeLabel: Record<
  GrowthRewardSettlementResultTypeEnum,
  string
> = {
  [GrowthRewardSettlementResultTypeEnum.APPLIED]: '本次真实落账',
  [GrowthRewardSettlementResultTypeEnum.IDEMPOTENT]: '命中幂等未重复落账',
  [GrowthRewardSettlementResultTypeEnum.FAILED]: '本次处理失败',
}
