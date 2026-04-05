import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

interface MessageWsMetricDelta {
  requestCount?: number
  ackSuccessCount?: number
  ackErrorCount?: number
  ackLatencyTotalMs?: number
  reconnectCount?: number
  resyncTriggerCount?: number
  resyncSuccessCount?: number
}

@Injectable()
export class MessageWsMonitorService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** WebSocket 指标桶表。 */
  private get metric() {
    return this.drizzle.schema.messageWsMetric
  }

  /**
   * 记录一次 WS 请求下发。
   * 该计数用于观察单位时间内的消息分发压力。
   */
  async recordRequest() {
    await this.applyDelta({ requestCount: 1 })
  }

  /**
   * 记录一次 ACK 结果。
   * 成功与失败计数分开累加，延迟会被规整成非负整数毫秒后写入总和桶。
   */
  async recordAck(code: number, latencyMs: number) {
    const normalizedLatencyMs = Math.max(0, Math.floor(Number(latencyMs) || 0))
    await this.applyDelta({
      ackSuccessCount: code === 0 ? 1 : 0,
      ackErrorCount: code === 0 ? 0 : 1,
      ackLatencyTotalMs: normalizedLatencyMs,
    })
  }

  /**
   * 记录一次连接重连。
   */
  async recordReconnect() {
    await this.applyDelta({ reconnectCount: 1 })
  }

  /**
   * 记录一次重同步触发。
   */
  async recordResyncTriggered() {
    await this.applyDelta({ resyncTriggerCount: 1 })
  }

  /**
   * 记录一次重同步成功。
   */
  async recordResyncSuccess() {
    await this.applyDelta({ resyncSuccessCount: 1 })
  }

  /**
   * 把监控增量写入当前分钟桶。
   * 先尝试更新已有桶，未命中时再插入并通过冲突更新兜底，避免并发下丢统计。
   */
  private async applyDelta(delta: MessageWsMetricDelta) {
    const bucketAt = this.getCurrentBucketAt()
    await this.drizzle.withErrorHandling(async () => {
      const updated = await this.db
        .update(this.metric)
        .set({
          requestCount: sql`${this.metric.requestCount} + ${delta.requestCount ?? 0}`,
          ackSuccessCount: sql`${this.metric.ackSuccessCount} + ${delta.ackSuccessCount ?? 0}`,
          ackErrorCount: sql`${this.metric.ackErrorCount} + ${delta.ackErrorCount ?? 0}`,
          ackLatencyTotalMs: sql`${this.metric.ackLatencyTotalMs} + ${BigInt(delta.ackLatencyTotalMs ?? 0)}`,
          reconnectCount: sql`${this.metric.reconnectCount} + ${delta.reconnectCount ?? 0}`,
          resyncTriggerCount: sql`${this.metric.resyncTriggerCount} + ${delta.resyncTriggerCount ?? 0}`,
          resyncSuccessCount: sql`${this.metric.resyncSuccessCount} + ${delta.resyncSuccessCount ?? 0}`,
        })
        .where(eq(this.metric.bucketAt, bucketAt))
        .returning({ id: this.metric.id })

      if (updated.length > 0) {
        return
      }

      await this.db
        .insert(this.metric)
        .values({
          bucketAt,
          requestCount: delta.requestCount ?? 0,
          ackSuccessCount: delta.ackSuccessCount ?? 0,
          ackErrorCount: delta.ackErrorCount ?? 0,
          ackLatencyTotalMs: BigInt(delta.ackLatencyTotalMs ?? 0),
          reconnectCount: delta.reconnectCount ?? 0,
          resyncTriggerCount: delta.resyncTriggerCount ?? 0,
          resyncSuccessCount: delta.resyncSuccessCount ?? 0,
        })
        .onConflictDoUpdate({
          target: this.metric.bucketAt,
          set: {
            requestCount: sql`${this.metric.requestCount} + ${delta.requestCount ?? 0}`,
            ackSuccessCount: sql`${this.metric.ackSuccessCount} + ${delta.ackSuccessCount ?? 0}`,
            ackErrorCount: sql`${this.metric.ackErrorCount} + ${delta.ackErrorCount ?? 0}`,
            ackLatencyTotalMs: sql`${this.metric.ackLatencyTotalMs} + ${BigInt(delta.ackLatencyTotalMs ?? 0)}`,
            reconnectCount: sql`${this.metric.reconnectCount} + ${delta.reconnectCount ?? 0}`,
            resyncTriggerCount: sql`${this.metric.resyncTriggerCount} + ${delta.resyncTriggerCount ?? 0}`,
            resyncSuccessCount: sql`${this.metric.resyncSuccessCount} + ${delta.resyncSuccessCount ?? 0}`,
          },
        })
    })
  }

  /**
   * 计算当前指标桶时间。
   * 所有监控数据按分钟聚合，因此秒和毫秒统一归零。
   */
  private getCurrentBucketAt() {
    const now = new Date()
    now.setSeconds(0, 0)
    return now
  }
}
