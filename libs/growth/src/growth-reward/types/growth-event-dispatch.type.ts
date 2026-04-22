import type { EventDefinitionConsumerEnum } from '../../event-definition/event-definition.type'
import type { EventEnvelope } from '../../event-definition/event-envelope.type'
import type { GrowthRuleTypeEnum } from '../../growth-rule.constant'
import type { TaskEventProgressResult } from '../../task/task.type'
import type { GrowthRuleRewardSettlementResult } from './growth-reward-result.type'

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
