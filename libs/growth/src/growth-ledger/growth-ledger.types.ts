import type { GrowthAssetTypeEnum, GrowthLedgerFailReasonEnum } from './growth-ledger.constant'

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
