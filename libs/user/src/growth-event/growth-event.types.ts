import type { UserGrowthEventDto } from './dto/growth-event.dto'

/**
 * 成长事件消息总线接口
 */
export interface UserGrowthEventBus {
  /** 发布成长事件 */
  publish: (event: UserGrowthEventDto) => Promise<void>
  /** 订阅成长事件处理器 */
  subscribe: (
    handler: (event: UserGrowthEventDto) => void | Promise<void>,
  ) => () => void
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
