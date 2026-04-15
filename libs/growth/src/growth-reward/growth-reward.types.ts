import type { EventDefinitionConsumerEnum } from '../event-definition/event-definition.type'
import type { EventEnvelope } from '../event-definition/event-envelope.type'
import type {
  GrowthAssetTypeEnum,
  GrowthLedgerFailReasonEnum,
  GrowthLedgerSourceEnum,
} from '../growth-ledger/growth-ledger.constant'
import type { GrowthLedgerApplyResult } from '../growth-ledger/growth-ledger.internal'
import type { GrowthRuleTypeEnum } from '../growth-rule.constant'
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

export interface TaskRewardAssetResult {
  assetType: GrowthAssetTypeEnum.POINTS | GrowthAssetTypeEnum.EXPERIENCE
  configuredAmount: number
  success: boolean
  duplicated: boolean
  skipped: boolean
  recordId?: number
  reason?: GrowthLedgerFailReasonEnum | 'not_configured'
}

export interface TaskRewardSettlementResult {
  success: boolean
  resultType: TaskAssignmentRewardResultTypeEnum
  source: GrowthLedgerSourceEnum.TASK_BONUS
  bizKey: string
  dedupeResult: GrowthRewardDedupeResultEnum
  settledAt: Date
  ledgerRecordIds: number[]
  errorMessage?: string
  pointsReward: TaskRewardAssetResult
  experienceReward: TaskRewardAssetResult
}

export interface GrowthRuleRewardSettlementResult {
  success: boolean
  source: GrowthLedgerSourceEnum.GROWTH_RULE
  bizKey: string
  ruleType: GrowthRuleTypeEnum
  dedupeResult: GrowthRewardDedupeResultEnum
  ledgerRecordIds: number[]
  errorMessage?: string
  pointsResult?: GrowthLedgerApplyResult
  experienceResult?: GrowthLedgerApplyResult
}

export interface DispatchDefinedGrowthEventPayload {
  eventEnvelope: EventEnvelope<GrowthRuleTypeEnum>
  bizKey: string
  source: string
  remark?: string
  targetType?: number
  targetId?: number
  context?: Record<string, unknown>
}

export interface DispatchDefinedGrowthEventResult {
  definitionKey: string
  consumers: EventDefinitionConsumerEnum[]
  growthHandled: boolean
  growthBlockedByGovernance: boolean
  taskHandled: boolean
  taskEligible: boolean
  notificationEligible: boolean
  growthResult?: GrowthRuleRewardSettlementResult
  taskResult?: TaskEventProgressResult
}
