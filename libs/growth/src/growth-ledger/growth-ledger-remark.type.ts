import type { GrowthRuleTypeEnum } from '../growth-rule.constant'
import type {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
} from './growth-ledger.constant'

/**
 * 账本说明文案解析输入。
 * 统一收敛规则型与直接落账型 remark 的最小判定维度。
 */
export interface ResolveGrowthLedgerRemarkInput {
  assetType: GrowthAssetTypeEnum
  source: string
  action: GrowthLedgerActionEnum
  ruleType?: GrowthRuleTypeEnum | number | null
}

/**
 * 历史账本说明文案回填输入。
 * 旧数据没有显式 action 时，允许通过 delta 正负推导动作。
 */
export interface ResolveStoredGrowthLedgerRemarkInput {
  assetType: GrowthAssetTypeEnum
  source: string
  delta: number
  ruleType?: GrowthRuleTypeEnum | number | null
}
