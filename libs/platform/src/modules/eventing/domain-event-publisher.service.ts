import type { DbExecutor } from '@db/core'
import type {
  PublishDomainEventBatchResult,
  PublishDomainEventInput,
  PublishDomainEventResult,
} from './domain-event.type'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DomainEventDispatchStatusEnum } from './eventing.constant'

/**
 * 通用领域事件发布器。
 * 统一负责把领域事实与按 consumer 拆分的 dispatch 记录写入数据库。
 */
@Injectable()
export class DomainEventPublisher {
  constructor(private readonly drizzle: DrizzleService) {}

  private get domainEvent() {
    return this.drizzle.schema.domainEvent
  }

  private get domainEventDispatch() {
    return this.drizzle.schema.domainEventDispatch
  }

  // dispatch 返回面严格限定为稳定领域记录，归档保留字段仅供后台维护。
  private buildDomainEventDispatchRecordSelect() {
    return {
      id: this.domainEventDispatch.id,
      eventId: this.domainEventDispatch.eventId,
      consumer: this.domainEventDispatch.consumer,
      status: this.domainEventDispatch.status,
      retryCount: this.domainEventDispatch.retryCount,
      nextRetryAt: this.domainEventDispatch.nextRetryAt,
      lastError: this.domainEventDispatch.lastError,
      processedAt: this.domainEventDispatch.processedAt,
      createdAt: this.domainEventDispatch.createdAt,
      updatedAt: this.domainEventDispatch.updatedAt,
    }
  }

  async publish(
    input: PublishDomainEventInput,
  ): Promise<PublishDomainEventResult> {
    return this.drizzle.withTransaction({
      execute: async (tx) => this.publishInTx(tx, input),
    })
  }

  async publishInTx(
    tx: DbExecutor,
    input: PublishDomainEventInput,
  ): Promise<PublishDomainEventResult> {
    if (!input.consumers.length) {
      throw new BadRequestException('领域事件至少需要声明一个 consumer')
    }

    const occurredAt = input.occurredAt ?? new Date()
    // 领域事件是不可变完整事实，发布结果必须保留完整载荷。
    const insertedEvents = await tx
      .insert(this.domainEvent)
      .values({
        eventKey: input.eventKey,
        domain: input.domain,
        idempotencyKey: input.idempotencyKey,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        targetType: input.targetType,
        targetId: input.targetId,
        operatorId: input.operatorId,
        occurredAt,
        context: input.context,
      })
      .onConflictDoNothing({
        target: [this.domainEvent.domain, this.domainEvent.idempotencyKey],
      })
      .returning()

    const event = insertedEvents[0]
    if (!event) {
      if (!input.idempotencyKey) {
        throw new Error('领域事件写入失败')
      }

      // 幂等命中时同样读取完整领域事实，避免丢失原始 context。
      const existingEvents = await tx
        .select()
        .from(this.domainEvent)
        .where(
          and(
            eq(this.domainEvent.domain, input.domain),
            eq(this.domainEvent.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1)
      const existingEvent = existingEvents[0]
      if (!existingEvent) {
        throw new Error('领域事件幂等查询失败')
      }

      const existingDispatches = await tx
        .select(this.buildDomainEventDispatchRecordSelect())
        .from(this.domainEventDispatch)
        .where(eq(this.domainEventDispatch.eventId, existingEvent.id))

      return {
        duplicated: true,
        event: {
          ...existingEvent,
          context: this.normalizeContext(existingEvent.context),
        },
        dispatches: existingDispatches,
      }
    }

    const insertedDispatches = await tx
      .insert(this.domainEventDispatch)
      .values(
        input.consumers.map((consumer) => ({
          eventId: event.id,
          consumer,
          status: DomainEventDispatchStatusEnum.PENDING,
        })),
      )
      .returning(this.buildDomainEventDispatchRecordSelect())

    return {
      duplicated: false,
      event: {
        ...event,
        context: this.normalizeContext(event.context),
      },
      dispatches: insertedDispatches,
    }
  }

  async publishManyByIdempotencyKey(
    inputs: PublishDomainEventInput[],
  ): Promise<PublishDomainEventBatchResult> {
    return this.drizzle.withTransaction({
      execute: async (tx) => this.publishManyByIdempotencyKeyInTx(tx, inputs),
    })
  }

  async publishManyByIdempotencyKeyInTx(
    tx: DbExecutor,
    inputs: PublishDomainEventInput[],
  ): Promise<PublishDomainEventBatchResult> {
    if (inputs.length === 0) {
      return {
        insertedCount: 0,
        duplicatedCount: 0,
        events: [],
        dispatches: [],
      }
    }

    const normalizedInputs = inputs.map((input) => {
      if (!input.consumers.length) {
        throw new BadRequestException('领域事件至少需要声明一个 consumer')
      }
      if (!input.idempotencyKey?.trim()) {
        throw new BadRequestException('批量发布领域事件必须提供幂等键')
      }

      return {
        ...input,
        idempotencyKey: input.idempotencyKey.trim(),
        occurredAt: input.occurredAt ?? new Date(),
      }
    })

    // 批量发布的领域事件与单条发布一致，返回完整不可变事实。
    const insertedEvents = await tx
      .insert(this.domainEvent)
      .values(
        normalizedInputs.map((input) => ({
          eventKey: input.eventKey,
          domain: input.domain,
          idempotencyKey: input.idempotencyKey,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          targetType: input.targetType,
          targetId: input.targetId,
          operatorId: input.operatorId,
          occurredAt: input.occurredAt,
          context: input.context,
        })),
      )
      .onConflictDoNothing({
        target: [this.domainEvent.domain, this.domainEvent.idempotencyKey],
      })
      .returning()

    const insertedEventMap = new Map(
      insertedEvents.map((event) => [
        `${event.domain}:${event.idempotencyKey ?? ''}`,
        event,
      ]),
    )

    const dispatchValues = normalizedInputs.flatMap((input) => {
      const event = insertedEventMap.get(
        `${input.domain}:${input.idempotencyKey}`,
      )
      if (!event) {
        return []
      }

      return input.consumers.map((consumer) => ({
        eventId: event.id,
        consumer,
        status: DomainEventDispatchStatusEnum.PENDING,
      }))
    })

    const insertedDispatches = dispatchValues.length
      ? await tx
          .insert(this.domainEventDispatch)
          .values(dispatchValues)
          .returning(this.buildDomainEventDispatchRecordSelect())
      : []

    return {
      insertedCount: insertedEvents.length,
      duplicatedCount: normalizedInputs.length - insertedEvents.length,
      events: insertedEvents.map((event) => ({
        ...event,
        context: this.normalizeContext(event.context),
      })),
      dispatches: insertedDispatches,
    }
  }

  private normalizeContext<T>(value: T): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  }
}
