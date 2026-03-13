import type {
  QueryMessageOutboxMonitorDto,
  QueryMessageWsMonitorDto,
} from './dto/message-monitor.dto'
import { MessageOutboxStatusEnum } from '@libs/message'
import { PlatformService, Prisma } from '@libs/platform/database'
import { Injectable } from '@nestjs/common'

@Injectable()
export class MessageMonitorService extends PlatformService {
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
      this.prisma.messageOutbox.count({
        where: {
          status: MessageOutboxStatusEnum.PENDING,
        },
      }),
      this.prisma.messageOutbox.count({
        where: {
          status: MessageOutboxStatusEnum.PROCESSING,
        },
      }),
      this.prisma.messageOutbox.count({
        where: {
          status: MessageOutboxStatusEnum.FAILED,
        },
      }),
      this.prisma.messageOutbox.count({
        where: {
          status: MessageOutboxStatusEnum.PENDING,
          OR: [
            { nextRetryAt: null },
            { nextRetryAt: { lte: now } },
          ],
        },
      }),
      this.prisma.messageOutbox.count({
        where: {
          status: MessageOutboxStatusEnum.PENDING,
          nextRetryAt: { gt: now },
        },
      }),
      this.prisma.messageOutbox.count({
        where: {
          status: MessageOutboxStatusEnum.PENDING,
          retryCount: { gt: 0 },
        },
      }),
      this.prisma.messageOutbox.findFirst({
        where: {
          status: MessageOutboxStatusEnum.PENDING,
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.messageOutbox.groupBy({
        by: ['domain', 'status'],
        _count: {
          status: true,
        },
      }),
      this.prisma.messageOutbox.count({
        where: {
          status: MessageOutboxStatusEnum.SUCCESS,
          processedAt: { gte: windowStartAt },
        },
      }),
      this.prisma.messageOutbox.count({
        where: {
          status: MessageOutboxStatusEnum.FAILED,
          processedAt: { gte: windowStartAt },
        },
      }),
      this.prisma.messageOutbox.aggregate({
        where: {
          status: {
            in: [
              MessageOutboxStatusEnum.PENDING,
              MessageOutboxStatusEnum.PROCESSING,
              MessageOutboxStatusEnum.FAILED,
            ],
          },
        },
        _max: {
          retryCount: true,
        },
        _avg: {
          retryCount: true,
        },
      }),
      this.prisma.messageOutbox.count({
        where: {
          status: MessageOutboxStatusEnum.FAILED,
          lastError: null,
        },
      }),
      this.prisma.$queryRaw<Array<{ message: string, count: bigint }>>(Prisma.sql`
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

    const oldestPendingCreatedAt = oldestPending?.createdAt ?? undefined
    const oldestPendingAgeSeconds
      = oldestPendingCreatedAt
        ? Math.max(
            0,
            Math.floor((now.getTime() - oldestPendingCreatedAt.getTime()) / 1000),
          )
        : undefined

    const processedTotalCountInWindow
      = processedSuccessCountInWindow + processedFailedCountInWindow
    const averageProcessedPerMinute = Number(
      (processedTotalCountInWindow / (windowHours * 60)).toFixed(4),
    )

    return {
      snapshotAt: now,
      windowStartAt,
      windowHours,
      pendingCount,
      processingCount,
      failedCount,
      readyToConsumeCount,
      delayedPendingCount,
      retryingPendingCount,
      oldestPendingCreatedAt,
      oldestPendingAgeSeconds,
      processedSuccessCountInWindow,
      processedFailedCountInWindow,
      processedTotalCountInWindow,
      averageProcessedPerMinute,
      maxRetryCount: retryAggregate._max.retryCount ?? 0,
      avgRetryCount: Number((retryAggregate._avg.retryCount ?? 0).toFixed(4)),
      failedWithoutErrorCount,
      domainStatus: domainStatusRows
        .map((item) => ({
          domain: item.domain,
          status: item.status,
          count: item._count.status,
        }))
        .sort((prev, next) => {
          if (prev.domain === next.domain) {
            return prev.status - next.status
          }
          return prev.domain - next.domain
        }),
      topErrors: topErrorsRows.map((item) => ({
        message: item.message,
        count: Number(item.count),
      })),
    }
  }

  async getWsMonitorSummary(query: QueryMessageWsMonitorDto) {
    const now = new Date()
    const windowHours = this.normalizeWindowHours(query.windowHours)
    const windowStartAt = new Date(now.getTime() - windowHours * 60 * 60 * 1000)

    const aggregate = await this.prisma.messageWsMetric.aggregate({
      where: {
        bucketAt: {
          gte: windowStartAt,
        },
      },
      _sum: {
        requestCount: true,
        ackSuccessCount: true,
        ackErrorCount: true,
        ackLatencyTotalMs: true,
        reconnectCount: true,
        resyncTriggerCount: true,
        resyncSuccessCount: true,
      },
    })

    const requestCount = aggregate._sum.requestCount ?? 0
    const ackSuccessCount = aggregate._sum.ackSuccessCount ?? 0
    const ackErrorCount = aggregate._sum.ackErrorCount ?? 0
    const ackTotalCount = ackSuccessCount + ackErrorCount
    const ackLatencyTotalMs = Number(aggregate._sum.ackLatencyTotalMs ?? 0n)
    const reconnectCount = aggregate._sum.reconnectCount ?? 0
    const resyncTriggerCount = aggregate._sum.resyncTriggerCount ?? 0
    const resyncSuccessCount = aggregate._sum.resyncSuccessCount ?? 0

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
