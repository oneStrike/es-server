/**
 * 成长账本资产类型
 * 统一积分与经验的资产标识
 */
export enum GrowthAssetTypeEnum {
  POINTS = 1,
  EXPERIENCE = 2,
}

/**
 * 成长结算动作
 */
export enum GrowthLedgerActionEnum {
  GRANT = 'GRANT',
  CONSUME = 'CONSUME',
}

/**
 * 成长结算失败原因
 */
export enum GrowthLedgerFailReasonEnum {
  RULE_NOT_FOUND = 'rule_not_found',
  RULE_DISABLED = 'rule_disabled',
  RULE_ZERO = 'rule_zero',
  DAILY_LIMIT = 'daily_limit',
  TOTAL_LIMIT = 'total_limit',
  COOLDOWN = 'cooldown',
  INSUFFICIENT_BALANCE = 'insufficient_balance',
}

/**
 * 成长结算失败原因中文映射
 */
export const GrowthLedgerFailReasonLabel: Record<
  GrowthLedgerFailReasonEnum,
  string
> = {
  [GrowthLedgerFailReasonEnum.RULE_NOT_FOUND]: '规则不存在',
  [GrowthLedgerFailReasonEnum.RULE_DISABLED]: '规则已禁用',
  [GrowthLedgerFailReasonEnum.RULE_ZERO]: '规则值为零',
  [GrowthLedgerFailReasonEnum.DAILY_LIMIT]: '已达每日上限',
  [GrowthLedgerFailReasonEnum.TOTAL_LIMIT]: '已达总上限',
  [GrowthLedgerFailReasonEnum.COOLDOWN]: '冷却中',
  [GrowthLedgerFailReasonEnum.INSUFFICIENT_BALANCE]: '余额不足',
}
