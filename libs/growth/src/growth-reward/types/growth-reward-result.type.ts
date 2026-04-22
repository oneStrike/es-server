import type {
  GrowthLedgerFailReasonEnum,
  GrowthLedgerSourceEnum,
} from '../../growth-ledger/growth-ledger.constant'
import type { GrowthLedgerApplyResult } from '../../growth-ledger/growth-ledger.internal'
import type { GrowthRuleTypeEnum } from '../../growth-rule.constant'
import type { GrowthRewardRuleAssetTypeEnum } from '../../reward-rule/reward-rule.constant'
import type { TaskRewardSettlementResultTypeEnum } from '../../task/task.constant'

/** 奖励发放幂等结果枚举。 */
export enum GrowthRewardDedupeResultEnum {
  APPLIED = 'applied',
  IDEMPOTENT = 'idempotent',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

/** 任务奖励项被跳过时的原因枚举。 */
export enum TaskRewardAssetSkipReasonEnum {
  NOT_CONFIGURED = 'not_configured',
}

/** 稳定领域类型 `TaskRewardAssetResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface TaskRewardAssetResult {
  assetType: GrowthRewardRuleAssetTypeEnum
  assetKey?: string
  configuredAmount: number
  success: boolean
  duplicated: boolean
  skipped: boolean
  recordId?: number
  reason?: GrowthLedgerFailReasonEnum | TaskRewardAssetSkipReasonEnum
}

/** 稳定领域类型 `TaskRewardSettlementResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface TaskRewardSettlementResult {
  success: boolean
  resultType: TaskRewardSettlementResultTypeEnum
  source: GrowthLedgerSourceEnum.TASK_BONUS
  bizKey: string
  dedupeResult: GrowthRewardDedupeResultEnum
  settledAt: Date
  ledgerRecordIds: number[]
  errorMessage?: string
  rewardResults: TaskRewardAssetResult[]
}

/** 稳定领域类型 `GrowthRuleRewardAssetResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface GrowthRuleRewardAssetResult {
  assetType: GrowthRewardRuleAssetTypeEnum
  assetKey?: string
  result: GrowthLedgerApplyResult
}

/** 稳定领域类型 `GrowthRuleRewardSettlementResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface GrowthRuleRewardSettlementResult {
  success: boolean
  source: GrowthLedgerSourceEnum.GROWTH_RULE
  bizKey: string
  ruleType: GrowthRuleTypeEnum
  dedupeResult: GrowthRewardDedupeResultEnum
  ledgerRecordIds: number[]
  errorMessage?: string
  failureReason?: GrowthLedgerFailReasonEnum
  rewardResults: GrowthRuleRewardAssetResult[]
}

/** 账本逐项落账结果列表。 */
export type GrowthRewardApplyResultList = Array<
  GrowthLedgerApplyResult | undefined
>
