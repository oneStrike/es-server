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
  /** 发放资产 */
  GRANT = 1,
  /** 扣减资产 */
  CONSUME = 2,
  /** 规则判定过程 */
  APPLY_RULE = 3,
  /** 授予徽章 */
  ASSIGN_BADGE = 4,
}

/**
 * 成长审计判定结果
 */
export enum GrowthAuditDecisionEnum {
  /** 允许执行 */
  ALLOW = 1,
  /** 拒绝执行 */
  DENY = 2,
}

/**
 * 成长账本来源
 *
 * 用于区分基础成长规则奖励与任务 bonus 奖励；
 * 其他历史/手工来源仍允许沿用字符串来源值。
 */
export enum GrowthLedgerSourceEnum {
  GROWTH_RULE = 'growth_rule',
  TASK_BONUS = 'task_bonus',
  CHECK_IN_BASE_BONUS = 'check_in_base_bonus',
  CHECK_IN_STREAK_BONUS = 'check_in_streak_bonus',
}

/**
 * 成长规则限流槽位类型。
 */
export enum GrowthRuleUsageSlotTypeEnum {
  DAILY = 1,
  TOTAL = 2,
  COOLDOWN = 3,
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
  [GrowthLedgerFailReasonEnum.RULE_ZERO]: '数值必须大于零',
  [GrowthLedgerFailReasonEnum.DAILY_LIMIT]: '已达每日上限',
  [GrowthLedgerFailReasonEnum.TOTAL_LIMIT]: '已达总上限',
  [GrowthLedgerFailReasonEnum.COOLDOWN]: '冷却中',
  [GrowthLedgerFailReasonEnum.INSUFFICIENT_BALANCE]: '余额不足',
}
