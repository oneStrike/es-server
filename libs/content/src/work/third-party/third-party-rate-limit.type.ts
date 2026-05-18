/** 第三方资源限流失败原因，供 HTTP/provider/service 链路复用并保留重试诊断。 */
export interface ThirdPartyRateLimitCause {
  rateLimited: true
  reason: string
  path?: string
  status?: number
  retryAfterHeader?: string
  retryAfterMs?: number
  retryAt?: string
}
