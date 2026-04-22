import type {
  GrowthRuleTypeEnum,
  GrowthRuleTypeKey,
} from '../growth-rule.constant'
import type {
  EventDefinitionConsumerEnum,
  EventDefinitionDomainEnum,
  EventDefinitionEntityTypeEnum,
  EventDefinitionGovernanceGateEnum,
  EventDefinitionImplStatusEnum,
} from './event-definition.constant'

/**
 * 单条事件定义。
 * 作为任务、成长、通知与治理共享的统一元数据事实源。
 */
export interface EventDefinition {
  code: GrowthRuleTypeEnum
  key: GrowthRuleTypeKey
  label: string
  ledgerRemark: string
  domain: EventDefinitionDomainEnum
  subjectType: EventDefinitionEntityTypeEnum
  targetType: EventDefinitionEntityTypeEnum
  governanceGate: EventDefinitionGovernanceGateEnum
  consumers: ReadonlyArray<EventDefinitionConsumerEnum>
  implStatus: EventDefinitionImplStatusEnum
  isRuleConfigurable: boolean
}

/**
 * 事件定义映射表。
 * 使用稳定数值编码作为唯一索引键。
 */
export type EventDefinitionMap = Record<GrowthRuleTypeEnum, EventDefinition>

/** 事件定义事实源写法使用的内部草稿类型。 */
export type EventDefinitionDraft = Omit<
  EventDefinition,
  'code' | 'key' | 'consumers' | 'ledgerRemark'
> & {
  consumers: ReadonlyArray<EventDefinitionConsumerEnum>
  ledgerRemark?: string
}

/**
 * 事件定义列表查询条件。
 * 当前重点支持已实现、可配置与下游复用筛选。
 */
export interface ListEventDefinitionFilters {
  domain?: EventDefinitionDomainEnum
  governanceGate?: EventDefinitionGovernanceGateEnum
  consumer?: EventDefinitionConsumerEnum
  implStatus?: EventDefinitionImplStatusEnum
  isImplemented?: boolean
  isRuleConfigurable?: boolean
}
