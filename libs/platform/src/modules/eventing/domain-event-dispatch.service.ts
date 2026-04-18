import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from './domain-event.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, inArray, isNull, lte, or } from 'drizzle-orm'
import {
  DOMAIN_EVENT_DISPATCH_BATCH_SIZE,
  DOMAIN_EVENT_DISPATCH_MAX_RETRY,
  DOMAIN_EVENT_DISPATCH_PROCESSING_TIMEOUT_SECONDS,
  DomainEventConsumerEnum,
  DomainEventDispatchStatusEnum,
} from './eventing.constant'

/**
 * 通用领域事件 dispatch 状态机服务。
 * 负责 claim、成功、失败、超时回收等通用调度语义。
 */
@Injectable()
export class DomainEventDispatchService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get domainEvent() {
    return this.drizzle.schema.domainEvent
  }

  private get domainEventDispatch() {
    return this.drizzle.schema.domainEventDispatch
  }

  buildProcessingDeadline() {
    const deadline = new Date()
    deadline.setSeconds(
      deadline.getSeconds() + DOMAIN_EVENT_DISPATCH_PROCESSING_TIMEOUT_SECONDS,
    )
    return deadline
  }

  async claimPendingDispatchByEvent(
    eventId: bigint,
    consumer: DomainEventConsumerEnum,
  ) {
    const claimedRows = await this.db
      .update(this.domainEventDispatch)
      .set({
        status: DomainEventDispatchStatusEnum.PROCESSING,
        nextRetryAt: this.buildProcessingDeadline(),
      })
      .where(
        and(
          eq(this.domainEventDispatch.eventId, eventId),
          eq(this.domainEventDispatch.consumer, consumer),
          eq(
            this.domainEventDispatch.status,
            DomainEventDispatchStatusEnum.PENDING,
          ),
        ),
      )
      .returning()

    return claimedRows[0] ?? null
  }

  async claimPendingDispatchBatch(consumers: DomainEventConsumerEnum[]) {
    const now = new Date()
    const candidateRows = await this.db
      .select()
      .from(this.domainEventDispatch)
      .where(
        and(
          consumers.length === 1
            ? eq(this.domainEventDispatch.consumer, consumers[0])
            : or(
                ...consumers.map((consumer) =>
                  eq(this.domainEventDispatch.consumer, consumer),
                ),
              ),
          eq(
            this.domainEventDispatch.status,
            DomainEventDispatchStatusEnum.PENDING,
          ),
          or(
            isNull(this.domainEventDispatch.nextRetryAt),
            lte(this.domainEventDispatch.nextRetryAt, now),
          ),
        ),
      )
      .orderBy(asc(this.domainEventDispatch.id))
      .limit(DOMAIN_EVENT_DISPATCH_BATCH_SIZE)

    const candidateDispatchIds = candidateRows.map((dispatch) => dispatch.id)
    if (candidateDispatchIds.length === 0) {
      return []
    }

    const claimedRows = await this.db
      .update(this.domainEventDispatch)
      .set({
        status: DomainEventDispatchStatusEnum.PROCESSING,
        nextRetryAt: this.buildProcessingDeadline(),
      })
      .where(
        and(
          inArray(this.domainEventDispatch.id, candidateDispatchIds),
          eq(
            this.domainEventDispatch.status,
            DomainEventDispatchStatusEnum.PENDING,
          ),
        ),
      )
      .returning()

    if (claimedRows.length === 0) {
      return []
    }

    const uniqueEventIds = [...new Set(claimedRows.map((row) => row.eventId))]
    const events = await this.db.query.domainEvent.findMany({
      where: {
        id: {
          in: uniqueEventIds,
        },
      },
    })
    const eventMap = new Map(
      events.map((event) => [
        event.id,
        {
          ...event,
          context:
            event.context &&
            typeof event.context === 'object' &&
            !Array.isArray(event.context)
              ? (event.context as Record<string, unknown>)
              : null,
        } satisfies DomainEventRecord,
      ]),
    )

    const claimedPairs: Array<{
      dispatch: DomainEventDispatchRecord
      event: DomainEventRecord
    }> = []

    for (const claimed of claimedRows.sort((prev, next) =>
      Number(prev.id - next.id),
    )) {
      const event = eventMap.get(claimed.eventId)
      if (!event) {
        continue
      }

      claimedPairs.push({
        dispatch: claimed,
        event,
      })
    }

    return claimedPairs
  }

  async markDispatchSucceeded(dispatchId: bigint) {
    const processedAt = new Date()
    const result = await this.db
      .update(this.domainEventDispatch)
      .set({
        status: DomainEventDispatchStatusEnum.SUCCESS,
        processedAt,
        nextRetryAt: null,
        lastError: null,
      })
      .where(eq(this.domainEventDispatch.id, dispatchId))

    this.drizzle.assertAffectedRows(result, '领域事件 dispatch 不存在')
    return processedAt
  }

  async markDispatchFailed<T>(dispatch: DomainEventDispatchRecord, error: T) {
    const attemptedAt = new Date()
    const nextRetryCount = dispatch.retryCount + 1
    const errorMessage = this.stringifyError(error).slice(0, 500)

    if (nextRetryCount >= DOMAIN_EVENT_DISPATCH_MAX_RETRY) {
      const result = await this.db
        .update(this.domainEventDispatch)
        .set({
          status: DomainEventDispatchStatusEnum.FAILED,
          retryCount: nextRetryCount,
          lastError: errorMessage,
          processedAt: attemptedAt,
        })
        .where(eq(this.domainEventDispatch.id, dispatch.id))

      this.drizzle.assertAffectedRows(result, '领域事件 dispatch 不存在')
      return
    }

    const nextRetryAt = new Date()
    const backoffSeconds = Math.min(300, 2 ** nextRetryCount)
    nextRetryAt.setSeconds(nextRetryAt.getSeconds() + backoffSeconds)

    const result = await this.db
      .update(this.domainEventDispatch)
      .set({
        status: DomainEventDispatchStatusEnum.PENDING,
        retryCount: nextRetryCount,
        nextRetryAt,
        lastError: errorMessage,
      })
      .where(eq(this.domainEventDispatch.id, dispatch.id))

    this.drizzle.assertAffectedRows(result, '领域事件 dispatch 不存在')
  }

  async recoverStaleDispatches(consumers: DomainEventConsumerEnum[]) {
    const now = new Date()
    const staleRows = await this.db
      .select()
      .from(this.domainEventDispatch)
      .where(
        and(
          consumers.length === 1
            ? eq(this.domainEventDispatch.consumer, consumers[0])
            : or(
                ...consumers.map((consumer) =>
                  eq(this.domainEventDispatch.consumer, consumer),
                ),
              ),
          eq(
            this.domainEventDispatch.status,
            DomainEventDispatchStatusEnum.PROCESSING,
          ),
          lte(this.domainEventDispatch.nextRetryAt, now),
        ),
      )

    for (const dispatch of staleRows) {
      await this.markDispatchFailed(
        dispatch as DomainEventDispatchRecord,
        new Error('domain event dispatch processing timeout recovered'),
      )
    }
  }

  async retryFailedDispatch(
    dispatchId: bigint,
    consumer?: DomainEventConsumerEnum,
  ) {
    const conditions = [
      eq(this.domainEventDispatch.id, dispatchId),
      eq(this.domainEventDispatch.status, DomainEventDispatchStatusEnum.FAILED),
    ]
    if (consumer) {
      conditions.push(eq(this.domainEventDispatch.consumer, consumer))
    }

    const result = await this.db
      .update(this.domainEventDispatch)
      .set({
        status: DomainEventDispatchStatusEnum.PENDING,
        retryCount: 0,
        nextRetryAt: null,
        processedAt: null,
        lastError: null,
      })
      .where(and(...conditions))

    return (result.rowCount ?? 0) > 0
  }

  private stringifyError<T>(error: T) {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown error'
    }
  }
}
