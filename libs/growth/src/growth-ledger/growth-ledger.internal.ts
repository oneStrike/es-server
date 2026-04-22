import type {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerFailReasonEnum,
} from './growth-ledger.constant'

export const PUBLIC_GROWTH_LEDGER_CONTEXT_KEYS = [
  'actorUserId',
  'assignmentId',
  'cycleId',
  'exchangeId',
  'followedUserId',
  'grantId',
  'outTradeNo',
  'paymentMethod',
  'planId',
  'purchaseId',
  'recordId',
  'ruleId',
  'targetId',
  'taskId',
] as const

export type PublicGrowthLedgerContextKey =
  typeof PUBLIC_GROWTH_LEDGER_CONTEXT_KEYS[number]

export type PublicGrowthLedgerContextValue =
  | boolean
  | number
  | string
  | null

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

/**
 * 直接结算参数（不走规则表）。
 */
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
 * 公开时间线记录结构。
 * 供 service 内部映射与外部消费保持统一字段语义。
 */
export interface PublicGrowthLedgerRecord {
  id: number
  userId: number
  assetType: GrowthAssetTypeEnum
  assetKey?: string
  source: string
  ruleId?: number
  ruleType?: number
  targetType?: number
  targetId?: number
  delta: number
  beforeValue: number
  afterValue: number
  bizKey: string
  remark?: string
  context?: PublicGrowthLedgerContext
  createdAt: Date
}
