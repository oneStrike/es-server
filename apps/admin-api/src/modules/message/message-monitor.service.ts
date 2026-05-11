import type {
  QueryMessageDispatchPageDto,
  QueryMessageWsMonitorDto,
} from '@libs/message/monitor/dto/message-monitor.dto'
import type { QueryNotificationDeliveryPageDto } from '@libs/message/notification/dto/notification.dto'
import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/core'

import { MessageNotificationDeliveryService } from '@libs/message/notification/notification-delivery.service'
import { parsePositiveBigintQueryId } from '@libs/message/notification/notification-query-id.util'
import { DomainEventDispatchService } from '@libs/platform/modules/eventing/domain-event-dispatch.service'
import { DomainEventConsumerEnum } from '@libs/platform/modules/eventing/eventing.constant'
import { Injectable, Logger } from '@nestjs/common'
import { and, desc, eq, gte, sql } from 'drizzle-orm'

@Injectable()
export class MessageMonitorService {
  private readonly logger = new Logger(MessageMonitorService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly messageNotificationDeliveryService: MessageNotificationDeliveryService,
    private readonly domainEventDispatchService: DomainEventDispatchService,
  ) {}

  // 读取注入的数据库客户端。
  private get db() {
    return this.drizzle.db
  }

  // 读取领域事件表。
  private get domainEvent() {
    return this.drizzle.schema.domainEvent
  }

  // 读取领域事件 dispatch 表。
  private get domainEventDispatch() {
    return this.drizzle.schema.domainEventDispatch
  }

  // 读取通知投递表。
  private get notificationDelivery() {
    return this.drizzle.schema.notificationDelivery
  }

  // 读取 WebSocket 指标表。
  private get messageWsMetric() {
    return this.drizzle.schema.messageWsMetric
  }

  // 查询通知投递分页，复用通知投递领域服务的对外契约。
  async getNotificationDeliveryPage(query: QueryNotificationDeliveryPageDto) {
    return this.messageNotificationDeliveryService.getNotificationDeliveryPage(
      query,
    )
  }

  // 查询通知 dispatch 监控分页。
  async getNotificationDispatchPage(query: QueryMessageDispatchPageDto) {
    const domainEvent = this.domainEvent
    const domainEventDispatch = this.domainEventDispatch
    const notificationDelivery = this.notificationDelivery
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

  // 按 dispatch ID 重试通知投递，输入非法直接按协议错误抛出。
  async retryNotificationDeliveryByDispatchId(dispatchId: string) {
    const parsedDispatchId = parsePositiveBigintQueryId(
      dispatchId,
      'dispatchId',
    )

    try {
      return await this.domainEventDispatchService.retryFailedDispatch(
        parsedDispatchId,
        DomainEventConsumerEnum.NOTIFICATION,
      )
    } catch (error) {
      this.logger.warn(
        `Failed to retry notification dispatch ${parsedDispatchId.toString()} for ${DomainEventConsumerEnum.NOTIFICATION}: ${this.stringifyError(error)}`,
      )
      throw error
    }
  }

  // 汇总 WebSocket 监控指标窗口。
  async getWsMonitorSummary(query: QueryMessageWsMonitorDto) {
    const messageWsMetric = this.messageWsMetric
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

  // 构造通知 dispatch 监控查询条件。
  private buildDispatchPageConditions(
    query: QueryMessageDispatchPageDto,
  ): SQL[] {
    const domainEvent = this.domainEvent
    const domainEventDispatch = this.domainEventDispatch
    const notificationDelivery = this.notificationDelivery
    const conditions: SQL[] = [
      eq(domainEventDispatch.consumer, DomainEventConsumerEnum.NOTIFICATION),
    ]
    const eventKey = this.getTrimmedString(query.eventKey)
    const domain = this.getTrimmedString(query.domain)
    const projectionKey = this.getTrimmedString(query.projectionKey)
    const eventId = this.parseOptionalQueryId(query.eventId, 'eventId')
    const dispatchId = this.parseOptionalQueryId(query.dispatchId, 'dispatchId')

    if (query.dispatchStatus !== undefined) {
      conditions.push(eq(domainEventDispatch.status, query.dispatchStatus))
    }
    if (query.deliveryStatus !== undefined) {
      conditions.push(eq(notificationDelivery.status, query.deliveryStatus))
    }
    if (eventKey) {
      conditions.push(eq(domainEvent.eventKey, eventKey))
    }
    if (domain) {
      conditions.push(eq(domainEvent.domain, domain))
    }
    if (query.receiverUserId != null) {
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

  // 去除字符串首尾空白，空字符串按未传处理。
  private getTrimmedString(value?: string | null): string | undefined {
    const normalizedValue = value?.trim()
    return normalizedValue || undefined
  }

  // 解析可选正整数字符串查询条件。
  private parseOptionalQueryId(
    value: string | null | undefined,
    fieldName: string,
  ): bigint | undefined {
    const normalizedValue = this.getTrimmedString(value)
    if (!normalizedValue) {
      return undefined
    }
    return parsePositiveBigintQueryId(normalizedValue, fieldName)
  }

  // 规整分页正整数，非法值回落到默认值。
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

  // 计算四位小数比率，分母为空时返回 0。
  private calculateRate(numerator: number, denominator: number): number {
    if (!denominator) {
      return 0
    }
    return Number((numerator / denominator).toFixed(4))
  }

  // 规整 WS 指标查询窗口。
  private normalizeWindowHours(windowHours?: number) {
    if (!Number.isFinite(Number(windowHours))) {
      return 24
    }
    return Math.min(Math.max(1, Math.floor(Number(windowHours))), 168)
  }

  // 把未知错误对象收敛成日志可读文本。
  private stringifyError(error: unknown) {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown'
    }
  }
}
