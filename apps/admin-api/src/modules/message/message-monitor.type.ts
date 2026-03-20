/**
 * Outbox 监控查询入参。
 * 用于约束监控窗口时长与 TopN 错误条数。
 */
export interface MessageOutboxMonitorQueryInput {
  windowHours?: number
  topErrorsLimit?: number
}

/**
 * WS 监控查询入参。
 * 用于约束聚合窗口时长。
 */
export interface MessageWsMonitorQueryInput {
  windowHours?: number
}
