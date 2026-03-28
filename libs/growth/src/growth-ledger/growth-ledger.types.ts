import type { GrowthAssetTypeEnum, GrowthLedgerFailReasonEnum } from './growth-ledger.constant'

export const PUBLIC_GROWTH_LEDGER_CONTEXT_KEYS = [
  'actorUserId',
  'assignmentId',
  'exchangeId',
  'followedUserId',
  'outTradeNo',
  'paymentMethod',
  'purchaseId',
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

export interface QueryGrowthLedgerPageInput {
  userId: number
  assetType?: GrowthAssetTypeEnum
  ruleId?: number | null
  ruleType?: number | null
  targetType?: number | null
  targetId?: number | null
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

export interface PublicGrowthLedgerRecord {
  id: number
  userId: number
  assetType: GrowthAssetTypeEnum
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

/**
 * 成长结算结果
 */
export interface GrowthLedgerApplyResult {
  success: boolean
  duplicated?: boolean
  reason?: GrowthLedgerFailReasonEnum
  deltaApplied?: number
  beforeValue?: number
  afterValue?: number
  ruleId?: number
  recordId?: number
}

/**
 * 规则结算参数
 */
export interface ApplyRuleParams {
  userId: number
  assetType: GrowthAssetTypeEnum
  ruleType: number
  bizKey: string
  remark?: string
  targetType?: number
  targetId?: number
  context?: Record<string, unknown>
  occurredAt?: Date
}

/**
 * 直接结算参数（不走规则表）
 */
export interface ApplyDeltaParams {
  userId: number
  assetType: GrowthAssetTypeEnum
  action: 'GRANT' | 'CONSUME'
  amount: number
  bizKey: string
  source: string
  remark?: string
  targetType?: number
  targetId?: number
  context?: Record<string, unknown>
}
