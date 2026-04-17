import type { EventDefinitionConsumerEnum } from '../event-definition/event-definition.type'
import type { EventEnvelope } from '../event-definition/event-envelope.type'
import type {
  GrowthLedgerFailReasonEnum,
  GrowthLedgerSourceEnum,
} from '../growth-ledger/growth-ledger.constant'
import type { GrowthLedgerApplyResult } from '../growth-ledger/growth-ledger.internal'
import type { GrowthRuleTypeEnum } from '../growth-rule.constant'
import type { GrowthRewardRuleAssetTypeEnum } from '../reward-rule/reward-rule.constant'
import type {
  TaskAssignmentRewardResultTypeEnum,
} from '../task/task.constant'
import type { TaskEventProgressResult } from '../task/task.type'

export enum GrowthRewardDedupeResultEnum {
  APPLIED = 'applied',
  IDEMPOTENT = 'idempotent',
  SKIPPED = 'skipped',
  FAILED = 'failed',
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
  reason?: GrowthLedgerFailReasonEnum | 'not_configured'
}

/** 稳定领域类型 `TaskRewardSettlementResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface TaskRewardSettlementResult {
  success: boolean
  resultType: TaskAssignmentRewardResultTypeEnum
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

/** 稳定领域类型 `DispatchDefinedGrowthEventPayload`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface DispatchDefinedGrowthEventPayload {
  eventEnvelope: EventEnvelope<GrowthRuleTypeEnum>
  bizKey: string
  source: string
  remark?: string
  targetType?: number
  targetId?: number
  context?: Record<string, unknown>
}

/** 稳定领域类型 `DispatchDefinedGrowthEventResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface DispatchDefinedGrowthEventResult {
  definitionKey: string
  consumers: EventDefinitionConsumerEnum[]
  growthHandled: boolean
  growthBlockedByGovernance: boolean
  taskHandled: boolean
  taskEligible: boolean
  notificationEligible: boolean
  taskErrorMessage?: string
  growthResult?: GrowthRuleRewardSettlementResult
  taskResult?: TaskEventProgressResult
}

/** 稳定领域类型 `SerializedDispatchDefinedGrowthEventPayload`。仅供补偿事实存储与重试链路复用，避免重复定义。 */
export interface SerializedDispatchDefinedGrowthEventPayload {
  eventEnvelope: {
    code: number
    key: string
    subjectType: string
    subjectId: number
    targetType: string
    targetId: number
    operatorId?: number
    occurredAt: string
    governanceStatus: string
    context?: Record<string, unknown>
  }
  bizKey: string
  source: string
  remark?: string
  targetType?: number
  targetId?: number
  context?: Record<string, unknown>
}
