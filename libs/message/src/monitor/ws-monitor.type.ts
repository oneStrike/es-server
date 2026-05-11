/** WebSocket 指标分钟桶增量。 */
export interface MessageWsMetricDelta {
  requestCount?: number
  ackSuccessCount?: number
  ackErrorCount?: number
  ackLatencyTotalMs?: number
  reconnectCount?: number
  resyncTriggerCount?: number
  resyncSuccessCount?: number
}
