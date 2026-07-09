import type {
  QueryMessageDispatchPageDto,
  QueryMessageWsMonitorDto,
  RetryMessageNotificationDeliveryDto,
} from '@libs/message/monitor/dto/message-monitor.dto'
import type { QueryNotificationDeliveryPageDto } from '@libs/message/notification/dto/notification.dto'
import type { SQL } from 'drizzle-orm'
import { DrizzleService, toPageResult } from '@db/core'

import { getMessageDomainEventLabel } from '@libs/message/eventing/message-event.constant'
import { MessageNotificationDeliveryService } from '@libs/message/notification/notification-delivery.service'
import { parsePositiveBigintQueryId } from '@libs/message/notification/notification-query-id.util'
import {
  MessageNotificationDispatchStatusEnum,
} from '@libs/message/notification/notification.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { DomainEventDispatchService } from '@libs/platform/modules/eventing/domain-event-dispatch.service'
import {
  DomainEventConsumerEnum,
  DomainEventDispatchStatusEnum,
} from '@libs/platform/modules/eventing/eventing.constant'
import { buildDateOnlyRangeInAppTimeZone, jsonParse } from '@libs/platform/utils'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'

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

  async getMonitorSummary() {
    const [deliveryCounts, dispatchCounts] = await Promise.all([
      this.countDeliveriesByStatus(),
      this.countDispatchesByStatus(),
    ])

    return {
      snapshotAt: new Date(),
      failedDeliveryCount:
        deliveryCounts.get(MessageNotificationDispatchStatusEnum.FAILED) ?? 0,
      retryingDeliveryCount:
        deliveryCounts.get(MessageNotificationDispatchStatusEnum.RETRYING) ?? 0,
      failedDispatchCount:
        dispatchCounts.get(DomainEventDispatchStatusEnum.FAILED) ?? 0,
      retryingDispatchCount:
        (dispatchCounts.get(DomainEventDispatchStatusEnum.PENDING) ?? 0) +
        (dispatchCounts.get(DomainEventDispatchStatusEnum.PROCESSING) ?? 0),
    }
  }

  // 查询通知 dispatch 监控分页。
  async getNotificationDispatchPage(query: QueryMessageDispatchPageDto) {
    const domainEvent = this.domainEvent
    const domainEventDispatch = this.domainEventDispatch
    const notificationDelivery = this.notificationDelivery
    const conditions = this.buildDispatchPageConditions(query)
    const page = this.drizzle.buildPage(query, {
      defaultPageSize: 15,
      maxPageSize: 100,
    })
    const whereClause = and(...conditions)
    const orderBySql = this.buildDispatchOrderBy(
      query.orderBy?.trim()
        ? query.orderBy
        : [{ updatedAt: 'desc' as const }, { id: 'desc' as const }],
    )

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
        categoryKey: notificationDelivery.categoryKey,
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
      .orderBy(...orderBySql)
      .limit(page.limit)
      .offset(page.offset)

    return toPageResult(
      rows.map((item) => ({
        ...item,
        dispatchId: item.dispatchId.toString(),
        eventId: item.eventId.toString(),
        eventKey: item.eventKey ?? '',
        eventLabel: getMessageDomainEventLabel(item.eventKey),
        domain: item.domain ?? '',
        categoryKey: item.categoryKey ?? null,
        deliveryStatus: item.deliveryStatus ?? null,
        lastError: this.sanitizeDiagnosticText(item.lastError),
      })),
      Number(totalRow?.count ?? 0),
      page,
    )
  }

  async retryNotificationDelivery(
    adminUserId: number,
    body: RetryMessageNotificationDeliveryDto,
  ) {
    const deliveryId = this.parsePositiveIntegerId(body.deliveryId, 'deliveryId')
    const reason = this.normalizeRetryReason(body.reason)
    const delivery = await this.db.query.notificationDelivery.findFirst({
      where: { id: deliveryId },
      columns: {
        id: true,
        dispatchId: true,
        eventId: true,
        eventKey: true,
        receiverUserId: true,
        projectionKey: true,
        categoryKey: true,
        status: true,
        failureReason: true,
      },
    })
    if (!delivery) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '投递记录不存在',
      )
    }
    if (delivery.status !== MessageNotificationDispatchStatusEnum.FAILED) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '只有投递失败的通知可以重试',
      )
    }

    const dispatch = await this.db.query.domainEventDispatch.findFirst({
      where: { id: delivery.dispatchId },
      columns: {
        id: true,
        consumer: true,
        status: true,
      },
    })
    if (
      !dispatch ||
      dispatch.consumer !== DomainEventConsumerEnum.NOTIFICATION
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '投递记录未关联通知发送任务',
      )
    }

    try {
      const result =
        await this.domainEventDispatchService.retryFailedDispatch(
          delivery.dispatchId,
          DomainEventConsumerEnum.NOTIFICATION,
        )
      this.logger.warn(this.buildRetryAuditLog(adminUserId, delivery, reason))
      return result
    } catch (error) {
      this.logger.warn(
        `Failed to retry notification delivery ${delivery.id} dispatch ${delivery.dispatchId.toString()} for ${DomainEventConsumerEnum.NOTIFICATION}: ${this.stringifyError(error)}`,
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
        fanoutSkippedCount: sql<number>`COALESCE(SUM(${messageWsMetric.fanoutSkippedCount}), 0)::int`,
        fanoutPublishErrorCount: sql<number>`COALESCE(SUM(${messageWsMetric.fanoutPublishErrorCount}), 0)::int`,
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
    const fanoutSkippedCount = aggregate?.fanoutSkippedCount ?? 0
    const fanoutPublishErrorCount = aggregate?.fanoutPublishErrorCount ?? 0
    const realtimeDeploymentRisk =
      fanoutSkippedCount > 0 || fanoutPublishErrorCount > 0

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
      fanoutSkippedCount,
      fanoutPublishErrorCount,
      resyncSuccessRate: this.calculateRate(
        resyncSuccessCount,
        resyncTriggerCount,
      ),
      realtimeDeploymentRisk,
      realtimeDeploymentConstraint: realtimeDeploymentRisk
        ? `跨实例实时推送存在风险：${fanoutSkippedCount} 次载荷过大跳过，${fanoutPublishErrorCount} 次发布失败；客户端需依赖补偿拉取兜底。`
        : null,
    }
  }

  private async countDeliveriesByStatus() {
    const rows = await this.db
      .select({
        status: this.notificationDelivery.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(this.notificationDelivery)
      .where(
        inArray(this.notificationDelivery.status, [
          MessageNotificationDispatchStatusEnum.FAILED,
          MessageNotificationDispatchStatusEnum.RETRYING,
        ]),
      )
      .groupBy(this.notificationDelivery.status)

    return new Map(
      rows.map((row) => [row.status, Number(row.count ?? 0)] as const),
    )
  }

  private async countDispatchesByStatus() {
    const rows = await this.db
      .select({
        status: this.domainEventDispatch.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(this.domainEventDispatch)
      .where(
        and(
          eq(
            this.domainEventDispatch.consumer,
            DomainEventConsumerEnum.NOTIFICATION,
          ),
          inArray(this.domainEventDispatch.status, [
            DomainEventDispatchStatusEnum.FAILED,
            DomainEventDispatchStatusEnum.PENDING,
            DomainEventDispatchStatusEnum.PROCESSING,
          ]),
        ),
      )
      .groupBy(this.domainEventDispatch.status)

    return new Map(
      rows.map((row) => [row.status, Number(row.count ?? 0)] as const),
    )
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
    const categoryKey = this.getTrimmedString(query.categoryKey)
    const eventId = this.parseOptionalQueryId(query.eventId, 'eventId')
    const dispatchId = this.parseOptionalQueryId(query.dispatchId, 'dispatchId')

    if (query.dispatchStatus !== undefined) {
      conditions.push(eq(domainEventDispatch.status, query.dispatchStatus))
    }
    if (query.deliveryStatus != null) {
      conditions.push(eq(notificationDelivery.status, query.deliveryStatus))
    }
    if (categoryKey) {
      conditions.push(eq(notificationDelivery.categoryKey, categoryKey))
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
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      query.startDate,
      query.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(gte(domainEventDispatch.updatedAt, dateRange.gte))
    }
    if (dateRange?.lt) {
      conditions.push(lt(domainEventDispatch.updatedAt, dateRange.lt))
    }

    return conditions
  }

  // 去除字符串首尾空白，空字符串按未传处理。
  private getTrimmedString(value?: string | null): string | undefined {
    const normalizedValue = value?.trim()
    // 查询条件专用：空字符串按"不筛选"处理，返回 undefined 让 Drizzle where 跳过该条件。
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

  private parsePositiveIntegerId(value: string, fieldName: string) {
    const parsed = parsePositiveBigintQueryId(value, fieldName)
    if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException(`${fieldName} 超出安全整数范围`)
    }
    return Number(parsed)
  }

  private normalizeRetryReason(value: string) {
    const normalized = value?.trim()
    if (!normalized || normalized.length < 5) {
      throw new BadRequestException('重试原因至少 5 个字符')
    }
    return normalized.slice(0, 200)
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

  private sanitizeDiagnosticText(value?: string | null) {
    const normalized = value?.replace(/\s+/g, ' ').trim()
    return normalized ? normalized.slice(0, 120) : null
  }

  private buildDispatchOrderBy(input: unknown) {
    const records = this.normalizeOrderByRecords(input)
    const columns = {
      updatedAt: this.domainEventDispatch.updatedAt,
      processedAt: this.domainEventDispatch.processedAt,
      nextRetryAt: this.domainEventDispatch.nextRetryAt,
      id: this.domainEventDispatch.id,
    } as const
    const orderBySql = records.map((record) => {
      const [field, direction] = Object.entries(record)[0] ?? []
      const column = columns[field as keyof typeof columns]
      if (!column) {
        throw new BadRequestException(`排序字段 "${field}" 不支持`)
      }
      return direction === 'asc' ? asc(column) : desc(column)
    })
    return records.some((record) => Object.hasOwn(record, 'id'))
      ? orderBySql
      : [...orderBySql, desc(this.domainEventDispatch.id)]
  }

  private normalizeOrderByRecords(input: unknown) {
    const parsed =
      typeof input === 'string' ? jsonParse<Record<string, string>[]>(input) : input
    const records = Array.isArray(parsed) ? parsed : [parsed]
    return records.map((record) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new BadRequestException('orderBy 参数格式不合法')
      }
      const entries = Object.entries(record as Record<string, unknown>)
      if (entries.length !== 1) {
        throw new BadRequestException('orderBy 每项只能包含一个排序字段')
      }
      const [field, direction] = entries[0]
      if (direction !== 'asc' && direction !== 'desc') {
        throw new BadRequestException(`排序字段 "${field}" 的排序方向无效`)
      }
      return { [field]: direction }
    })
  }

  private buildRetryAuditLog(
    adminUserId: number,
    delivery: {
      id: number
      dispatchId: bigint
      eventId: bigint
      eventKey: string
      receiverUserId: number | null
      categoryKey: string | null
      failureReason: string | null
    },
    reason: string,
  ) {
    return [
      'notification_delivery_retry',
      `adminUserId=${adminUserId}`,
      `deliveryId=${delivery.id}`,
      `dispatchId=${delivery.dispatchId.toString()}`,
      `eventId=${delivery.eventId.toString()}`,
      `receiverUserId=${delivery.receiverUserId ?? 'null'}`,
      `category=${delivery.categoryKey ?? 'unknown'}`,
      `eventKey=${delivery.eventKey}`,
      `failureSummary=${this.sanitizeDiagnosticText(delivery.failureReason) ?? 'none'}`,
      `reason=${reason}`,
    ].join(' ')
  }
}
