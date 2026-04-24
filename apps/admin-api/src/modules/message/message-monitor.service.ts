import type {
  QueryMessageDispatchPageDto,
  QueryMessageWsMonitorDto,
} from '@libs/message/monitor/dto/message-monitor.dto'
import type { QueryNotificationDeliveryPageDto } from '@libs/message/notification/dto/notification.dto'
import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/core'

import {
  domainEvent,
  domainEventDispatch,
  messageWsMetric,
  notificationDelivery,
} from '@db/schema'

import { MessageNotificationDeliveryService } from '@libs/message/notification/notification-delivery.service'
import { parsePositiveBigintQueryId } from '@libs/message/notification/notification-query-id.util'
import { DomainEventDispatchService } from '@libs/platform/modules/eventing/domain-event-dispatch.service'
import { DomainEventConsumerEnum } from '@libs/platform/modules/eventing/eventing.constant'
import { Injectable } from '@nestjs/common'
import { and, desc, eq, gte, sql } from 'drizzle-orm'

@Injectable()
export class MessageMonitorService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly messageNotificationDeliveryService: MessageNotificationDeliveryService,
    private readonly domainEventDispatchService: DomainEventDispatchService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  async getNotificationDeliveryPage(query: QueryNotificationDeliveryPageDto) {
    return this.messageNotificationDeliveryService.getNotificationDeliveryPage(
      query,
    )
  }

  async getNotificationDispatchPage(query: QueryMessageDispatchPageDto) {
    const conditions = this.buildDispatchPageConditions(query)
    const pageIndex = this.normalizePositiveInteger(query.pageIndex, 1)
    const pageSize = this.normalizePositiveInteger(query.pageSize, 15, 100)
    const whereClause = and(...conditions)

    const [totalRow] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(domainEventDispatch)
      .leftJoin(domainEvent, eq(domainEventDispatch.eventId, domainEvent.id))
      .leftJoin(
        notificationDelivery,
        eq(notificationDelivery.dispatchId, domainEventDispatch.id),
      )
      .where(whereClause)

    const rows = await this.db
      .select({
        dispatchId: domainEventDispatch.id,
        eventId: domainEventDispatch.eventId,
        consumer: domainEventDispatch.consumer,
        dispatchStatus: domainEventDispatch.status,
        retryCount: domainEventDispatch.retryCount,
        lastError: domainEventDispatch.lastError,
        nextRetryAt: domainEventDispatch.nextRetryAt,
        processedAt: domainEventDispatch.processedAt,
        eventKey: domainEvent.eventKey,
        domain: domainEvent.domain,
        receiverUserId: notificationDelivery.receiverUserId,
        projectionKey: notificationDelivery.projectionKey,
        deliveryStatus: notificationDelivery.status,
      })
      .from(domainEventDispatch)
      .leftJoin(domainEvent, eq(domainEventDispatch.eventId, domainEvent.id))
      .leftJoin(
        notificationDelivery,
        eq(notificationDelivery.dispatchId, domainEventDispatch.id),
      )
      .where(whereClause)
      .orderBy(
        desc(domainEventDispatch.updatedAt),
        desc(domainEventDispatch.id),
      )
      .limit(pageSize)
      .offset((pageIndex - 1) * pageSize)

    return {
      list: rows.map((item) => ({
        ...item,
        dispatchId: item.dispatchId.toString(),
        eventId: item.eventId.toString(),
        eventKey: item.eventKey ?? '',
        domain: item.domain ?? '',
        dispatchStatus: item.dispatchStatus,
        deliveryStatus: item.deliveryStatus ?? null,
      })),
      total: Number(totalRow?.count ?? 0),
      pageIndex,
      pageSize,
    }
  }

  async retryNotificationDeliveryByDispatchId(dispatchId: string) {
    const normalizedDispatchId = dispatchId.trim()
    if (!normalizedDispatchId) {
      return false
    }
    try {
      return await this.domainEventDispatchService.retryFailedDispatch(
        BigInt(normalizedDispatchId),
        DomainEventConsumerEnum.NOTIFICATION,
      )
    } catch {
      return false
    }
  }

  async getWsMonitorSummary(query: QueryMessageWsMonitorDto) {
    const now = new Date()
    const windowHours = this.normalizeWindowHours(query.windowHours)
    const windowStartAt = new Date(now.getTime() - windowHours * 60 * 60 * 1000)

    const aggregateRows = await this.db
      .select({
        requestCount: sql<number>`COALESCE(SUM(${messageWsMetric.requestCount}), 0)::int`,
        ackSuccessCount: sql<number>`COALESCE(SUM(${messageWsMetric.ackSuccessCount}), 0)::int`,
        ackErrorCount: sql<number>`COALESCE(SUM(${messageWsMetric.ackErrorCount}), 0)::int`,
        ackLatencyTotalMs: sql<bigint>`COALESCE(SUM(${messageWsMetric.ackLatencyTotalMs}), 0)::bigint`,
        reconnectCount: sql<number>`COALESCE(SUM(${messageWsMetric.reconnectCount}), 0)::int`,
        resyncTriggerCount: sql<number>`COALESCE(SUM(${messageWsMetric.resyncTriggerCount}), 0)::int`,
        resyncSuccessCount: sql<number>`COALESCE(SUM(${messageWsMetric.resyncSuccessCount}), 0)::int`,
      })
      .from(messageWsMetric)
      .where(gte(messageWsMetric.bucketAt, windowStartAt))

    const aggregate = aggregateRows[0]
    const requestCount = aggregate?.requestCount ?? 0
    const ackSuccessCount = aggregate?.ackSuccessCount ?? 0
    const ackErrorCount = aggregate?.ackErrorCount ?? 0
    const ackTotalCount = ackSuccessCount + ackErrorCount
    const ackLatencyTotalMs = Number(aggregate?.ackLatencyTotalMs ?? 0n)
    const reconnectCount = aggregate?.reconnectCount ?? 0
    const resyncTriggerCount = aggregate?.resyncTriggerCount ?? 0
    const resyncSuccessCount = aggregate?.resyncSuccessCount ?? 0

    return {
      snapshotAt: now,
      windowStartAt,
      windowHours,
      requestCount,
      ackSuccessCount,
      ackErrorCount,
      ackSuccessRate: this.calculateRate(ackSuccessCount, ackTotalCount),
      avgAckLatencyMs: this.calculateRate(ackLatencyTotalMs, ackTotalCount),
      reconnectCount,
      resyncTriggerCount,
      resyncSuccessCount,
      resyncSuccessRate: this.calculateRate(
        resyncSuccessCount,
        resyncTriggerCount,
      ),
    }
  }

  private buildDispatchPageConditions(
    query: QueryMessageDispatchPageDto,
  ): SQL[] {
    const conditions: SQL[] = [
      eq(domainEventDispatch.consumer, DomainEventConsumerEnum.NOTIFICATION),
    ]
    const eventKey = this.getTrimmedString(query.eventKey)
    const domain = this.getTrimmedString(query.domain)
    const projectionKey = this.getTrimmedString(query.projectionKey)
    const eventId = this.parseOptionalQueryId(query.eventId, 'eventId')
    const dispatchId = this.parseOptionalQueryId(query.dispatchId, 'dispatchId')

    if (query.dispatchStatus) {
      conditions.push(eq(domainEventDispatch.status, query.dispatchStatus))
    }
    if (query.deliveryStatus) {
      conditions.push(eq(notificationDelivery.status, query.deliveryStatus))
    }
    if (eventKey) {
      conditions.push(eq(domainEvent.eventKey, eventKey))
    }
    if (domain) {
      conditions.push(eq(domainEvent.domain, domain))
    }
    if (query.receiverUserId !== undefined) {
      conditions.push(
        eq(notificationDelivery.receiverUserId, query.receiverUserId),
      )
    }
    if (projectionKey) {
      conditions.push(eq(notificationDelivery.projectionKey, projectionKey))
    }
    if (eventId !== undefined) {
      conditions.push(eq(domainEventDispatch.eventId, eventId))
    }
    if (dispatchId !== undefined) {
      conditions.push(eq(domainEventDispatch.id, dispatchId))
    }

    return conditions
  }

  private getTrimmedString(value?: string): string | undefined {
    const normalizedValue = value?.trim()
    return normalizedValue || undefined
  }

  private parseOptionalQueryId(
    value: string | undefined,
    fieldName: string,
  ): bigint | undefined {
    const normalizedValue = this.getTrimmedString(value)
    if (!normalizedValue) {
      return undefined
    }
    return parsePositiveBigintQueryId(normalizedValue, fieldName)
  }

  private normalizePositiveInteger(
    value: number | undefined,
    defaultValue: number,
    maxValue?: number,
  ): number {
    if (!Number.isInteger(value) || Number(value) <= 0) {
      return defaultValue
    }
    if (maxValue === undefined) {
      return Number(value)
    }
    return Math.min(Number(value), maxValue)
  }

  private calculateRate(numerator: number, denominator: number): number {
    if (!denominator) {
      return 0
    }
    return Number((numerator / denominator).toFixed(4))
  }

  private normalizeWindowHours(windowHours?: number) {
    if (!Number.isFinite(Number(windowHours))) {
      return 24
    }
    return Math.min(Math.max(1, Math.floor(Number(windowHours))), 168)
  }
}
