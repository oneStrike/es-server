import type { GrowthRuleTypeEnum } from '../growth-rule.constant'
import type { GrowthRuleTypeKey } from '../growth-rule.type'
import type {
  CreateDefinedEventEnvelopeInput,
  CreateEventEnvelopeInput,
  EventEnvelope,
  EventEnvelopeCode,
  EventEnvelopeContext,
} from './event-envelope.type'
import {
  EventDefinitionConsumerEnum,
  EventDefinitionGovernanceGateEnum,
} from './event-definition.constant'
import { EVENT_DEFINITION_MAP } from './event-definition.map'
import { EventEnvelopeGovernanceStatusEnum } from './event-envelope.type'

// 创建自定义事件 envelope，不依赖统一定义层。
export function createEventEnvelope<
  TCode extends EventEnvelopeCode,
  TKey extends string,
>(input: CreateEventEnvelopeInput<TCode, TKey>): EventEnvelope<TCode, TKey> {
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

// 基于 EventDefinitionMap 创建 envelope，复用统一的 key 与主客体语义。
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

// 判断事件是否已经可以进入主消费链路。
export function canConsumeEventEnvelope(
  eventEnvelope: Pick<EventEnvelope, 'governanceStatus'>,
) {
  return (
    eventEnvelope.governanceStatus === EventEnvelopeGovernanceStatusEnum.NONE ||
    eventEnvelope.governanceStatus === EventEnvelopeGovernanceStatusEnum.PASSED
  )
}

// 按 consumer 维度判断事件是否可以进入对应主链路。
export function canConsumeEventEnvelopeByConsumer(
  eventEnvelope: Pick<EventEnvelope, 'code' | 'governanceStatus'>,
  consumer: EventDefinitionConsumerEnum,
) {
  if (consumer === EventDefinitionConsumerEnum.GOVERNANCE) {
    return true
  }

  if (
    eventEnvelope.governanceStatus === EventEnvelopeGovernanceStatusEnum.NONE
  ) {
    return true
  }

  const governanceGate = resolveEventEnvelopeGovernanceGate(eventEnvelope.code)
  if (governanceGate === EventDefinitionGovernanceGateEnum.REPORT_JUDGEMENT) {
    return (
      eventEnvelope.governanceStatus ===
      EventEnvelopeGovernanceStatusEnum.PASSED ||
      eventEnvelope.governanceStatus ===
      EventEnvelopeGovernanceStatusEnum.REJECTED
    )
  }

  return (
    eventEnvelope.governanceStatus === EventEnvelopeGovernanceStatusEnum.PASSED
  )
}

// 解析事件对应的治理闸门类型。
function resolveEventEnvelopeGovernanceGate(code: EventEnvelopeCode) {
  if (typeof code !== 'number') {
    return EventDefinitionGovernanceGateEnum.NONE
  }

  return (
    EVENT_DEFINITION_MAP[code]?.governanceGate ??
    EventDefinitionGovernanceGateEnum.NONE
  )
}

// 统一规整事件上下文，空对象视为未传。
function normalizeEventEnvelopeContext(context?: EventEnvelopeContext) {
  if (!context || Object.keys(context).length === 0) {
    return undefined
  }
  return context
}
