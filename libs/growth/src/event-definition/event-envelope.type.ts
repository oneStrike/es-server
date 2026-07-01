import type { GrowthRuleTypeEnum } from '../growth-rule.constant'
import type { EventDefinitionEntityTypeEnum } from './event-definition.constant'

/**
 * 轻量事件外壳的治理状态。
 * 用于表达事件是否已经可以进入奖励、通知等主消费链路。
 */
export enum EventEnvelopeGovernanceStatusEnum {
  NONE = 'none',
  PENDING = 'pending',
  PASSED = 'passed',
  REJECTED = 'rejected',
}

/**
 * 事件外壳允许使用的编码类型。
 * 已进入统一定义层的事件优先使用 GrowthRuleTypeEnum，其他领域事件先保留自定义字符串编码。
 */
export type EventEnvelopeCode = GrowthRuleTypeEnum | string

/**
 * 事件外壳允许使用的实体类型。
 * 已标准化实体优先复用 EventDefinitionEntityTypeEnum，未纳入定义层的场景可先使用稳定字符串。
 */
export type EventEnvelopeEntityType = EventDefinitionEntityTypeEnum | string

/**
 * 事件外壳上下文。
 * 只承载最小的补充说明字段，不承担完整业务 payload 存储职责。
 */
export type EventEnvelopeContext = Record<string, unknown>

/**
 * 轻量事件外壳。
 * 统一表达 code / key / subject / target / operator / occurredAt / governanceStatus / context。
 */
export interface EventEnvelope<
  TCode extends EventEnvelopeCode = EventEnvelopeCode,
  TKey extends string = string,
> {
  code: TCode
  key: TKey
  subjectType: EventEnvelopeEntityType
  subjectId: number
  targetType: EventEnvelopeEntityType
  targetId: number
  operatorId?: number
  occurredAt: Date
  governanceStatus: EventEnvelopeGovernanceStatusEnum
  context?: EventEnvelopeContext
}

/**
 * 基于统一事件定义创建 envelope 的入参。
 * code 对应的 key / subjectType / targetType 会自动从 EventDefinitionMap 读取。
 */
export interface CreateDefinedEventEnvelopeInput {
  code: GrowthRuleTypeEnum
  subjectId: number
  targetId: number
  operatorId?: number
  occurredAt?: Date
  governanceStatus?: EventEnvelopeGovernanceStatusEnum
  context?: EventEnvelopeContext
}

/**
 * 自定义事件 envelope 创建入参。
 * 适用于尚未进入统一定义层，但需要先共享语义壳的领域事件。
 */
export interface CreateEventEnvelopeInput<
  TCode extends EventEnvelopeCode = EventEnvelopeCode,
  TKey extends string = string,
> {
  code: TCode
  key: TKey
  subjectType: EventEnvelopeEntityType
  subjectId: number
  targetType: EventEnvelopeEntityType
  targetId: number
  operatorId?: number
  occurredAt?: Date
  governanceStatus?: EventEnvelopeGovernanceStatusEnum
  context?: EventEnvelopeContext
}
