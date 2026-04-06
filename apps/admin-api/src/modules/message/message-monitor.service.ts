import type { QueryMessageOutboxMonitorDto, QueryMessageWsMonitorDto } from '@libs/message/monitor/dto/message-monitor.dto';
import type { QueryNotificationDeliveryPageDto } from '@libs/message/notification/dto/notification.dto';
import { DrizzleService } from '@db/core'
import { messageOutbox, messageWsMetric } from '@db/schema'
import { MessageNotificationDeliveryService } from '@libs/message/notification/notification-delivery.service';
import { MessageOutboxDomainEnum, MessageOutboxStatusEnum } from '@libs/message/outbox/outbox.constant';
import { MessageOutboxService } from '@libs/message/outbox/outbox.service';
import { Injectable } from '@nestjs/common'
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

@Injectable()
export class MessageMonitorService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly messageNotificationDeliveryService: MessageNotificationDeliveryService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 分页查询通知投递结果
   * 管理端直接复用消息域的 delivery 视图，保持状态语义与筛选口径只有一套事实源
   */
  async getNotificationDeliveryPage(
    query: QueryNotificationDeliveryPageDto,
  ) {
    return this.messageNotificationDeliveryService.getNotificationDeliveryPage(
      query,
    )
  }

  /**
   * 按 bizKey 重试失败的通知 outbox 事件。
   */
  async retryNotificationDeliveryByBizKey(bizKey: string) {
    const normalizedBizKey = bizKey.trim()
    if (!normalizedBizKey) {
      return false
    }
    return this.messageOutboxService.retryFailedEventByBizKey({
      bizKey: normalizedBizKey,
      domain: MessageOutboxDomainEnum.NOTIFICATION,
    })
  }

  async getOutboxMonitorSummary(query: QueryMessageOutboxMonitorDto) {
    const now = new Date()
    const windowHours = this.normalizeWindowHours(query.windowHours)
    const topErrorsLimit = this.normalizeTopErrorsLimit(query.topErrorsLimit)
    const windowStartAt = new Date(now.getTime() - windowHours * 60 * 60 * 1000)

    const {
      pendingRows,
      processingRows,
      failedRows,
      readyRows,
      delayedRows,
      retryingRows,
      oldestRows,
      domainRows,
      successWindowRows,
      failedWindowRows,
      retryRows,
      failedWithoutErrorRows,
      topErrorRows,
    } = await this.queryOutboxMonitorSummaryRows(
      now,
      windowStartAt,
      topErrorsLimit,
    )

    const oldestPendingCreatedAt = oldestRows[0]?.createdAt ?? undefined
    const oldestPendingAgeSeconds
      = oldestPendingCreatedAt
        ? Math.max(
            0,
            Math.floor((now.getTime() - oldestPendingCreatedAt.getTime()) / 1000),
          )
        : undefined

    const processedSuccessCount = Number(successWindowRows[0]?.count ?? 0)
    const processedFailedCount = Number(failedWindowRows[0]?.count ?? 0)
    const processedTotalCountInWindow = processedSuccessCount + processedFailedCount
    const averageProcessedPerMinute = Number(
      (processedTotalCountInWindow / (windowHours * 60)).toFixed(4),
    )

    return {
      snapshotAt: now,
      windowStartAt,
      windowHours,
      pendingCount: Number(pendingRows[0]?.count ?? 0),
      processingCount: Number(processingRows[0]?.count ?? 0),
      failedCount: Number(failedRows[0]?.count ?? 0),
      readyToConsumeCount: Number(readyRows[0]?.count ?? 0),
      delayedPendingCount: Number(delayedRows[0]?.count ?? 0),
      retryingPendingCount: Number(retryingRows[0]?.count ?? 0),
      oldestPendingCreatedAt,
      oldestPendingAgeSeconds,
      processedSuccessCountInWindow: processedSuccessCount,
      processedFailedCountInWindow: processedFailedCount,
      processedTotalCountInWindow,
      averageProcessedPerMinute,
      maxRetryCount: Number(retryRows[0]?.maxRetryCount ?? 0),
      avgRetryCount: Number(Number(retryRows[0]?.avgRetryCount ?? 0).toFixed(4)),
      failedWithoutErrorCount: Number(failedWithoutErrorRows[0]?.count ?? 0),
      domainStatus: domainRows
        .map((item) => ({
          domain: item.domain,
          status: item.status,
          count: item.count,
        }))
        .sort((prev, next) => {
          if (prev.domain === next.domain) {
            return prev.status - next.status
          }
          return prev.domain - next.domain
        }),
      topErrors: topErrorRows.map((item) => ({
        message: item.message,
        count: Number(item.count),
      })),
    }
  }

  async getWsMonitorSummary(query: QueryMessageWsMonitorDto) {
    const now = new Date()
    const windowHours = this.normalizeWindowHours(query.windowHours)
    const windowStartAt = new Date(now.getTime() - windowHours * 60 * 60 * 1000)

    const aggregate = await this.queryWsMonitorSummaryRow(windowStartAt)

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
      ackSuccessRate: ackTotalCount
        ? Number((ackSuccessCount / ackTotalCount).toFixed(4))
        : 0,
      avgAckLatencyMs: ackTotalCount
        ? Number((ackLatencyTotalMs / ackTotalCount).toFixed(4))
        : 0,
      reconnectCount,
      resyncTriggerCount,
      resyncSuccessCount,
      resyncSuccessRate: resyncTriggerCount
        ? Number((resyncSuccessCount / resyncTriggerCount).toFixed(4))
        : 0,
    }
  }

  private async queryOutboxMonitorSummaryRows(
    now: Date,
    windowStartAt: Date,
    topErrorsLimit: number,
  ) {
    const status = {
      pending: MessageOutboxStatusEnum.PENDING,
      processing: MessageOutboxStatusEnum.PROCESSING,
      failed: MessageOutboxStatusEnum.FAILED,
      success: MessageOutboxStatusEnum.SUCCESS,
    }
    const [
      pendingRows,
      processingRows,
      failedRows,
      readyRows,
      delayedRows,
      retryingRows,
      oldestRows,
      domainRows,
      successWindowRows,
      failedWindowRows,
      retryRows,
      failedWithoutErrorRows,
      topErrorRows,
    ] = await Promise.all([
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(messageOutbox)
        .where(eq(messageOutbox.status, status.pending)),
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(messageOutbox)
        .where(eq(messageOutbox.status, status.processing)),
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(messageOutbox)
        .where(eq(messageOutbox.status, status.failed)),
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(messageOutbox)
        .where(
          and(
            eq(messageOutbox.status, status.pending),
            sql`(${messageOutbox.nextRetryAt} IS NULL OR ${messageOutbox.nextRetryAt} <= ${now})`,
          ),
        ),
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(messageOutbox)
        .where(
          and(
            eq(messageOutbox.status, status.pending),
            sql`${messageOutbox.nextRetryAt} > ${now}`,
          ),
        ),
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(messageOutbox)
        .where(
          and(
            eq(messageOutbox.status, status.pending),
            sql`${messageOutbox.retryCount} > 0`,
          ),
        ),
      this.db
        .select({ createdAt: messageOutbox.createdAt })
        .from(messageOutbox)
        .where(eq(messageOutbox.status, status.pending))
        .orderBy(asc(messageOutbox.createdAt))
        .limit(1),
      this.db
        .select({
          domain: messageOutbox.domain,
          status: messageOutbox.status,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(messageOutbox)
        .groupBy(messageOutbox.domain, messageOutbox.status),
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(messageOutbox)
        .where(
          and(
            eq(messageOutbox.status, status.success),
            gte(messageOutbox.processedAt, windowStartAt),
          ),
        ),
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(messageOutbox)
        .where(
          and(
            eq(messageOutbox.status, status.failed),
            gte(messageOutbox.processedAt, windowStartAt),
          ),
        ),
      this.db
        .select({
          maxRetryCount: sql<number | null>`MAX(${messageOutbox.retryCount})::int`,
          avgRetryCount: sql<string | null>`AVG(${messageOutbox.retryCount})::numeric`,
        })
        .from(messageOutbox)
        .where(
          inArray(messageOutbox.status, [
            status.pending,
            status.processing,
            status.failed,
          ]),
        ),
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(messageOutbox)
        .where(
          and(
            eq(messageOutbox.status, status.failed),
            isNull(messageOutbox.lastError),
          ),
        ),
      this.db
        .select({
          message: messageOutbox.lastError,
          count: sql<bigint>`COUNT(*)::bigint`,
        })
        .from(messageOutbox)
        .where(
          and(
            eq(messageOutbox.status, status.failed),
            isNotNull(messageOutbox.lastError),
          ),
        )
        .groupBy(messageOutbox.lastError)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(topErrorsLimit),
    ])

    return {
      pendingRows,
      processingRows,
      failedRows,
      readyRows,
      delayedRows,
      retryingRows,
      oldestRows,
      domainRows,
      successWindowRows,
      failedWindowRows,
      retryRows,
      failedWithoutErrorRows,
      topErrorRows: topErrorRows.map((item) => ({
        message: item.message ?? '',
        count: item.count,
      })),
    }
  }

  private async queryWsMonitorSummaryRow(windowStartAt: Date) {
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
    return aggregateRows[0]
  }

  private normalizeWindowHours(windowHours?: number) {
    if (!Number.isFinite(Number(windowHours))) {
      return 24
    }
    return Math.min(Math.max(1, Math.floor(Number(windowHours))), 168)
  }

  private normalizeTopErrorsLimit(topErrorsLimit?: number) {
    if (!Number.isFinite(Number(topErrorsLimit))) {
      return 5
    }
    return Math.min(Math.max(1, Math.floor(Number(topErrorsLimit))), 20)
  }
}
