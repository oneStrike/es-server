import type { Db } from '@db/core'
import type { PublishDomainEventBatchResult, PublishDomainEventResult } from '@libs/platform/modules/eventing/domain-event.type'
import type { PublishMessageDomainEventInput } from './message-event.type'
import { DomainEventPublisher } from '@libs/platform/modules/eventing/domain-event-publisher.service'
import { Injectable } from '@nestjs/common'
import { getMessageDomainEventDefinition } from './message-event.constant'

/**
 * 消息域领域事件发布器。
 * 统一根据静态事件定义补齐 domain 与 consumers，业务侧只负责提供事件上下文。
 */
@Injectable()
export class MessageDomainEventPublisher {
  constructor(private readonly domainEventPublisher: DomainEventPublisher) {}

  async publish(
    input: PublishMessageDomainEventInput,
  ): Promise<PublishDomainEventResult> {
    const definition = getMessageDomainEventDefinition(input.eventKey)
    return this.domainEventPublisher.publish({
      eventKey: input.eventKey,
      domain: definition.domain,
      idempotencyKey: this.resolveIdempotencyKey(input),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      targetType: input.targetType,
      targetId: input.targetId,
      operatorId: input.operatorId,
      occurredAt: input.occurredAt,
      consumers: [...definition.consumers],
      context: input.context,
    })
  }

  async publishInTx(
    tx: Db,
    input: PublishMessageDomainEventInput,
  ): Promise<PublishDomainEventResult> {
    const definition = getMessageDomainEventDefinition(input.eventKey)
    return this.domainEventPublisher.publishInTx(tx, {
      eventKey: input.eventKey,
      domain: definition.domain,
      idempotencyKey: this.resolveIdempotencyKey(input),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      targetType: input.targetType,
      targetId: input.targetId,
      operatorId: input.operatorId,
      occurredAt: input.occurredAt,
      consumers: [...definition.consumers],
      context: input.context,
    })
  }

  async publishMany(
    inputs: PublishMessageDomainEventInput[],
  ): Promise<PublishDomainEventBatchResult> {
    return this.domainEventPublisher.publishManyByIdempotencyKey(
      inputs.map((input) => {
        const definition = getMessageDomainEventDefinition(input.eventKey)
        return {
          eventKey: input.eventKey,
          domain: definition.domain,
          idempotencyKey: this.resolveIdempotencyKey(input),
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          targetType: input.targetType,
          targetId: input.targetId,
          operatorId: input.operatorId,
          occurredAt: input.occurredAt,
          consumers: [...definition.consumers],
          context: input.context,
        }
      }),
    )
  }

  private resolveIdempotencyKey(input: PublishMessageDomainEventInput) {
    if (
      typeof input.idempotencyKey === 'string' &&
      input.idempotencyKey.trim()
    ) {
      return input.idempotencyKey.trim()
    }

    const projectionKey = input.context?.projectionKey
    if (typeof projectionKey === 'string' && projectionKey.trim()) {
      return projectionKey.trim()
    }

    return undefined
  }
}
