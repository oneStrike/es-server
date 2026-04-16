import type {
  GrowthRuleTypeEnum,
  GrowthRuleTypeKey,
} from '../growth-rule.constant'
import type { EventDefinitionEntityTypeEnum } from './event-definition.type'
import { EVENT_DEFINITION_MAP } from './event-definition.map'
import {
  EventDefinitionConsumerEnum,
  EventDefinitionGovernanceGateEnum,
} from './event-definition.type'

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
/** 稳定领域类型 `EventEnvelopeCode`。仅供内部领域/服务链路复用，避免重复定义。 */
export type EventEnvelopeCode = GrowthRuleTypeEnum | string

/**
 * 事件外壳允许使用的实体类型。
 * 已标准化实体优先复用 EventDefinitionEntityTypeEnum，未纳入定义层的场景可先使用稳定字符串。
 */
/** 稳定领域类型 `EventEnvelopeEntityType`。仅供内部领域/服务链路复用，避免重复定义。 */
export type EventEnvelopeEntityType = EventDefinitionEntityTypeEnum | string

/**
 * 事件外壳上下文。
 * 只承载最小的补充说明字段，不承担完整业务 payload 存储职责。
 */
/** 稳定领域类型 `EventEnvelopeContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export type EventEnvelopeContext = Record<string, unknown>

/**
 * 轻量事件外壳。
 * 统一表达 code / key / subject / target / operator / occurredAt / governanceStatus / context。
 */
/** 稳定领域类型 `EventEnvelope`。仅供内部领域/服务链路复用，避免重复定义。 */
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
/** 稳定领域类型 `CreateDefinedEventEnvelopeInput`。仅供内部领域/服务链路复用，避免重复定义。 */
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
/** 稳定领域类型 `CreateEventEnvelopeInput`。仅供内部领域/服务链路复用，避免重复定义。 */
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

/**
 * 创建自定义事件 envelope。
 * 不依赖统一定义层，适合任务完成等仍在过渡中的事件语义。
 */
export function createEventEnvelope<
  TCode extends EventEnvelopeCode,
  TKey extends string,
>(
  input: CreateEventEnvelopeInput<TCode, TKey>,
): EventEnvelope<TCode, TKey> {
  return {
    code: input.code,
    key: input.key,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    targetType: input.targetType,
    targetId: input.targetId,
    operatorId: input.operatorId,
    occurredAt: input.occurredAt ?? new Date(),
    governanceStatus:
      input.governanceStatus ?? EventEnvelopeGovernanceStatusEnum.NONE,
    context: normalizeEventEnvelopeContext(input.context),
  }
}

/**
 * 基于 EventDefinitionMap 创建 envelope。
 * 统一复用已定义事件的 key / subjectType / targetType，避免 producer 再次手写复制。
 */
export function createDefinedEventEnvelope(
  input: CreateDefinedEventEnvelopeInput,
): EventEnvelope<GrowthRuleTypeEnum, GrowthRuleTypeKey> {
  const definition = EVENT_DEFINITION_MAP[input.code]
  if (!definition) {
    throw new Error(`未找到事件定义：${input.code}`)
  }

  return createEventEnvelope({
    code: definition.code,
    key: definition.key,
    subjectType: definition.subjectType,
    subjectId: input.subjectId,
    targetType: definition.targetType,
    targetId: input.targetId,
    operatorId: input.operatorId,
    occurredAt: input.occurredAt,
    governanceStatus: input.governanceStatus,
    context: input.context,
  })
}

/**
 * 判断事件是否已经可以进入主消费链路。
 * NONE / PASSED 视为可消费，PENDING / REJECTED 继续停留在治理态。
 */
export function canConsumeEventEnvelope(
  eventEnvelope: Pick<EventEnvelope, 'governanceStatus'>,
) {
  return (
    eventEnvelope.governanceStatus === EventEnvelopeGovernanceStatusEnum.NONE
    || eventEnvelope.governanceStatus === EventEnvelopeGovernanceStatusEnum.PASSED
  )
}

/**
 * 按 consumer 维度判断事件是否可以进入对应主链路。
 * - `GOVERNANCE` 始终可消费，用于审核/裁决待办与治理观察链路
 * - `TOPIC_APPROVAL / COMMENT_APPROVAL` 只有 PASSED 才能进入用户侧主链路
 * - `REPORT_JUDGEMENT` 在进入终态后即可被消费，因此 PASSED / REJECTED 都允许
 */
export function canConsumeEventEnvelopeByConsumer(
  eventEnvelope: Pick<EventEnvelope, 'code' | 'governanceStatus'>,
  consumer: EventDefinitionConsumerEnum,
) {
  if (consumer === EventDefinitionConsumerEnum.GOVERNANCE) {
    return true
  }

  if (eventEnvelope.governanceStatus === EventEnvelopeGovernanceStatusEnum.NONE) {
    return true
  }

  const governanceGate = resolveEventEnvelopeGovernanceGate(eventEnvelope.code)
  if (governanceGate === EventDefinitionGovernanceGateEnum.REPORT_JUDGEMENT) {
    return (
      eventEnvelope.governanceStatus === EventEnvelopeGovernanceStatusEnum.PASSED
      || eventEnvelope.governanceStatus === EventEnvelopeGovernanceStatusEnum.REJECTED
    )
  }

  return eventEnvelope.governanceStatus === EventEnvelopeGovernanceStatusEnum.PASSED
}

/**
 * 解析事件对应的治理闸门类型。
 * 已注册事件复用定义层元数据；自定义事件默认按无治理闸门处理。
 */
function resolveEventEnvelopeGovernanceGate(code: EventEnvelopeCode) {
  if (typeof code !== 'number') {
    return EventDefinitionGovernanceGateEnum.NONE
  }

  return (
    EVENT_DEFINITION_MAP[code]?.governanceGate
    ?? EventDefinitionGovernanceGateEnum.NONE
  )
}

function normalizeEventEnvelopeContext(
  context?: EventEnvelopeContext,
) {
  if (!context || Object.keys(context).length === 0) {
    return undefined
  }
  return context
}
