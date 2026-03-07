/**
 * 成长账本资产类型
 * 统一积分与经验的资产标识
 */
export enum GrowthAssetTypeEnum {
  POINTS = 'POINTS',
  EXPERIENCE = 'EXPERIENCE',
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
