import type {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerFailReasonEnum,
} from './growth-ledger.constant'
import type { PUBLIC_GROWTH_LEDGER_CONTEXT_KEYS } from './growth-ledger.internal'

/** 公开成长账本上下文允许暴露的键名。 */
export type PublicGrowthLedgerContextKey =
  (typeof PUBLIC_GROWTH_LEDGER_CONTEXT_KEYS)[number]

/** 公开成长账本上下文允许暴露的值类型。 */
export type PublicGrowthLedgerContextValue = boolean | number | string | null

/** 公开成长账本上下文结构。 */
export type PublicGrowthLedgerContext = Partial<
  Record<PublicGrowthLedgerContextKey, PublicGrowthLedgerContextValue>
>

/**
 * 成长结算结果。
 * 供奖励、签到等内部流程判断是否成功落账与是否命中幂等。
 */
export interface GrowthLedgerApplyResult {
  success: boolean
  duplicated?: boolean
  reason?: GrowthLedgerFailReasonEnum
  assetKey?: string
  deltaApplied?: number
  beforeValue?: number
  afterValue?: number
  ruleId?: number
  recordId?: number
}

/**
 * 规则结算参数。
 * 只用于账本内部发奖链路，不直接作为 HTTP 契约暴露。
 */
export interface ApplyRuleParams {
  userId: number
  assetType: GrowthAssetTypeEnum
  assetKey?: string
  ruleType: number
  bizKey: string
  source?: string
  targetType?: number
  targetId?: number
  context?: Record<string, unknown>
  occurredAt?: Date
}

/** 直接结算参数（不走规则表）。 */
export interface ApplyDeltaParams {
  userId: number
  assetType: GrowthAssetTypeEnum
  assetKey?: string
  action: GrowthLedgerActionEnum.GRANT | GrowthLedgerActionEnum.CONSUME
  amount: number
  bizKey: string
  source: string
  targetType?: number
  targetId?: number
  context?: Record<string, unknown>
}

/**
 * 已由业务根取得幂等键锁的非经验资产直接结算参数。
 * EXPERIENCE 必须保留账本后的终端等级同步阶段，禁止通过零加锁入口绕过。
 */
export interface ApplyNonExperienceDeltaParams extends ApplyDeltaParams {
  assetType: Exclude<GrowthAssetTypeEnum, GrowthAssetTypeEnum.EXPERIENCE>
}

/** 业务根在进入账本阶段前需要一次性锁定的幂等键。 */
export interface GrowthLedgerOperationLockInput {
  userId: number
  bizKey: string
}

/** 终端等级同步阶段在取得规则共享锁前发现的候选事实。 */
export interface GrowthLedgerLevelSyncCandidate {
  userId: number
  experience: number
  ruleId: number
}

/**
 * 公开时间线记录结构。
 * 供 service 内部映射与外部消费保持统一字段语义。
 */
export interface PublicGrowthLedgerRecord {
  id: number
  userId: number
  assetType: GrowthAssetTypeEnum
  assetKey: string | null
  source: string
  ruleId: number | null
  ruleType: number | null
  targetType: number | null
  targetId: number | null
  delta: number
  beforeValue: number
  afterValue: number
  bizKey: string
  remark: string | null
  context: PublicGrowthLedgerContext | null
  createdAt: Date
}
