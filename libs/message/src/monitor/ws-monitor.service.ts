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

  private get db() {
    return this.drizzle.db
  }

  private get metric() {
    return this.drizzle.schema.messageWsMetric
  }

  async recordRequest() {
    await this.applyDelta({ requestCount: 1 })
  }

  async recordAck(code: number, latencyMs: number) {
    const normalizedLatencyMs = Math.max(0, Math.floor(Number(latencyMs) || 0))
    await this.applyDelta({
      ackSuccessCount: code === 0 ? 1 : 0,
      ackErrorCount: code === 0 ? 0 : 1,
      ackLatencyTotalMs: normalizedLatencyMs,
    })
  }

  async recordReconnect() {
    await this.applyDelta({ reconnectCount: 1 })
  }

  async recordResyncTriggered() {
    await this.applyDelta({ resyncTriggerCount: 1 })
  }

  async recordResyncSuccess() {
    await this.applyDelta({ resyncSuccessCount: 1 })
  }

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

  private getCurrentBucketAt() {
    const now = new Date()
    now.setSeconds(0, 0)
    return now
  }
}
