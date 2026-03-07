import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'

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
export class MessageWsMonitorService extends BaseService {
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
    await this.prisma.messageWsMetric.upsert({
      where: { bucketAt },
      create: {
        bucketAt,
        requestCount: delta.requestCount ?? 0,
        ackSuccessCount: delta.ackSuccessCount ?? 0,
        ackErrorCount: delta.ackErrorCount ?? 0,
        ackLatencyTotalMs: BigInt(delta.ackLatencyTotalMs ?? 0),
        reconnectCount: delta.reconnectCount ?? 0,
        resyncTriggerCount: delta.resyncTriggerCount ?? 0,
        resyncSuccessCount: delta.resyncSuccessCount ?? 0,
      },
      update: {
        ...(delta.requestCount
          ? { requestCount: { increment: delta.requestCount } }
          : {}),
        ...(delta.ackSuccessCount
          ? { ackSuccessCount: { increment: delta.ackSuccessCount } }
          : {}),
        ...(delta.ackErrorCount
          ? { ackErrorCount: { increment: delta.ackErrorCount } }
          : {}),
        ...(delta.ackLatencyTotalMs
          ? { ackLatencyTotalMs: { increment: BigInt(delta.ackLatencyTotalMs) } }
          : {}),
        ...(delta.reconnectCount
          ? { reconnectCount: { increment: delta.reconnectCount } }
          : {}),
        ...(delta.resyncTriggerCount
          ? { resyncTriggerCount: { increment: delta.resyncTriggerCount } }
          : {}),
        ...(delta.resyncSuccessCount
          ? { resyncSuccessCount: { increment: delta.resyncSuccessCount } }
          : {}),
      },
    })
  }

  private getCurrentBucketAt() {
    const now = new Date()
    now.setSeconds(0, 0)
    return now
  }
}
