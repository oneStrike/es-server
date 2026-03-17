import type {
  QueryMessageOutboxMonitorDto,
  QueryMessageWsMonitorDto,
} from './dto/message-monitor.dto'
import { DrizzleService } from '@db/core'
import { MessageOutboxStatusEnum } from '@libs/message'
import { Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'

@Injectable()
export class MessageMonitorService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private extractRows<T>(result: unknown): T[] {
    if (!result || typeof result !== 'object' || !('rows' in result)) {
      return []
    }
    const rows = (result as { rows?: unknown }).rows
    return Array.isArray(rows) ? (rows as T[]) : []
  }

  async getOutboxMonitorSummary(query: QueryMessageOutboxMonitorDto) {
    const now = new Date()
    const windowHours = this.normalizeWindowHours(query.windowHours)
    const topErrorsLimit = this.normalizeTopErrorsLimit(query.topErrorsLimit)
    const windowStartAt = new Date(now.getTime() - windowHours * 60 * 60 * 1000)

    const [
      pendingCount,
      processingCount,
      failedCount,
      readyToConsumeCount,
      delayedPendingCount,
      retryingPendingCount,
      oldestPending,
      domainStatusRows,
      processedSuccessCountInWindow,
      processedFailedCountInWindow,
      retryAggregate,
      failedWithoutErrorCount,
      topErrorsRows,
    ] = await Promise.all([
      this.db.execute(sql`
        SELECT COUNT(*)::int AS "count"
        FROM message_outbox
        WHERE status = ${MessageOutboxStatusEnum.PENDING}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::int AS "count"
        FROM message_outbox
        WHERE status = ${MessageOutboxStatusEnum.PROCESSING}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::int AS "count"
        FROM message_outbox
        WHERE status = ${MessageOutboxStatusEnum.FAILED}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::int AS "count"
        FROM message_outbox
        WHERE status = ${MessageOutboxStatusEnum.PENDING}
          AND (next_retry_at IS NULL OR next_retry_at <= ${now})
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::int AS "count"
        FROM message_outbox
        WHERE status = ${MessageOutboxStatusEnum.PENDING}
          AND next_retry_at > ${now}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::int AS "count"
        FROM message_outbox
        WHERE status = ${MessageOutboxStatusEnum.PENDING}
          AND retry_count > 0
      `),
      this.db.execute(sql`
        SELECT created_at AS "createdAt"
        FROM message_outbox
        WHERE status = ${MessageOutboxStatusEnum.PENDING}
        ORDER BY created_at ASC
        LIMIT 1
      `),
      this.db.execute(sql`
        SELECT domain, status, COUNT(*)::int AS "count"
        FROM message_outbox
        GROUP BY domain, status
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::int AS "count"
        FROM message_outbox
        WHERE status = ${MessageOutboxStatusEnum.SUCCESS}
          AND processed_at >= ${windowStartAt}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::int AS "count"
        FROM message_outbox
        WHERE status = ${MessageOutboxStatusEnum.FAILED}
          AND processed_at >= ${windowStartAt}
      `),
      this.db.execute(sql`
        SELECT
          MAX(retry_count)::int AS "maxRetryCount",
          AVG(retry_count)::numeric AS "avgRetryCount"
        FROM message_outbox
        WHERE status IN (
          ${MessageOutboxStatusEnum.PENDING},
          ${MessageOutboxStatusEnum.PROCESSING},
          ${MessageOutboxStatusEnum.FAILED}
        )
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::int AS "count"
        FROM message_outbox
        WHERE status = ${MessageOutboxStatusEnum.FAILED}
          AND last_error IS NULL
      `),
      this.db.execute(sql`
        SELECT
          last_error AS "message",
          COUNT(*)::bigint AS "count"
        FROM message_outbox
        WHERE status = ${MessageOutboxStatusEnum.FAILED}
          AND last_error IS NOT NULL
        GROUP BY last_error
        ORDER BY COUNT(*) DESC
        LIMIT ${topErrorsLimit}
      `),
    ])

    const pendingRows = this.extractRows<{ count: number }>(pendingCount)
    const processingRows = this.extractRows<{ count: number }>(processingCount)
    const failedRows = this.extractRows<{ count: number }>(failedCount)
    const readyRows = this.extractRows<{ count: number }>(readyToConsumeCount)
    const delayedRows = this.extractRows<{ count: number }>(delayedPendingCount)
    const retryingRows = this.extractRows<{ count: number }>(retryingPendingCount)
    const oldestRows = this.extractRows<{ createdAt: Date }>(oldestPending)
    const domainRows = this.extractRows<{ domain: number, status: number, count: number }>(domainStatusRows)
    const successWindowRows = this.extractRows<{ count: number }>(processedSuccessCountInWindow)
    const failedWindowRows = this.extractRows<{ count: number }>(processedFailedCountInWindow)
    const retryRows = this.extractRows<{ maxRetryCount: number | null, avgRetryCount: string | null }>(retryAggregate)
    const failedWithoutErrorRows = this.extractRows<{ count: number }>(failedWithoutErrorCount)
    const topErrorRows = this.extractRows<{ message: string, count: bigint }>(topErrorsRows)

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

    const aggregateResult = await this.db.execute(sql`
      SELECT
        COALESCE(SUM(request_count), 0)::int AS "requestCount",
        COALESCE(SUM(ack_success_count), 0)::int AS "ackSuccessCount",
        COALESCE(SUM(ack_error_count), 0)::int AS "ackErrorCount",
        COALESCE(SUM(ack_latency_total_ms), 0)::bigint AS "ackLatencyTotalMs",
        COALESCE(SUM(reconnect_count), 0)::int AS "reconnectCount",
        COALESCE(SUM(resync_trigger_count), 0)::int AS "resyncTriggerCount",
        COALESCE(SUM(resync_success_count), 0)::int AS "resyncSuccessCount"
      FROM message_ws_metric
      WHERE bucket_at >= ${windowStartAt}
    `)
    const aggregateRows = this.extractRows<{
      requestCount: number
      ackSuccessCount: number
      ackErrorCount: number
      ackLatencyTotalMs: bigint
      reconnectCount: number
      resyncTriggerCount: number
      resyncSuccessCount: number
    }>(aggregateResult)
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
