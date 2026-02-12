/**
 * 成长事件处理状态枚举
 */
export enum UserGrowthEventStatus {
  /** 待处理 */
  PENDING = 'PENDING',
  /** 已处理 */
  PROCESSED = 'PROCESSED',
  /** 被反作弊拒绝 */
  REJECTED_ANTIFRAUD = 'REJECTED_ANTIFRAUD',
  /** 规则不存在而忽略 */
  IGNORED_RULE_NOT_FOUND = 'IGNORED_RULE_NOT_FOUND',
  /** 幂等重复而忽略 */
  IGNORED_DUPLICATE = 'IGNORED_DUPLICATE',
  /** 处理失败 */
  FAILED = 'FAILED',
}

/**
 * 成长规则引用
 */
export interface UserGrowthRuleRef {
  /** 规则类型 */
  type: 'point' | 'experience' | 'badge'
  /** 规则 ID */
  ruleId: number
  /** 变更数值 */
  delta?: number
}

/**
 * 成长事件应用结果
 */
export interface UserGrowthEventApplyResult {
  /** 实际发放积分 */
  pointsDeltaApplied: number
  /** 实际发放经验 */
  experienceDeltaApplied: number
  /** 实际发放徽章 */
  badgeAssigned?: { badgeId: number }[]
  /** 命中的规则引用 */
  ruleRefs: UserGrowthRuleRef[]
}

/**
 * 反作弊判定结果
 */
export interface UserGrowthAntifraudDecision {
  /** 是否允许发放 */
  allow: boolean
  /** 拒绝原因 */
  reason?: string
}
