import type { ThirdPartyRateLimitCause } from './third-party-rate-limit.type'

/** 从未知异常的 cause 中读取第三方限流诊断，供 workflow 决定是否延迟重试。 */
export function readThirdPartyRateLimit(
  error: unknown,
): ThirdPartyRateLimitCause | undefined {
  const cause = readCause(error)
  if (!cause || cause.rateLimited !== true) {
    return undefined
  }

  const reason = typeof cause.reason === 'string' ? cause.reason : undefined
  if (!reason) {
    return undefined
  }

  return {
    rateLimited: true,
    reason,
    ...(typeof cause.path === 'string' ? { path: cause.path } : {}),
    ...(typeof cause.status === 'number' ? { status: cause.status } : {}),
    ...(typeof cause.retryAfterHeader === 'string'
      ? { retryAfterHeader: cause.retryAfterHeader }
      : {}),
    ...(typeof cause.retryAfterMs === 'number'
      ? { retryAfterMs: cause.retryAfterMs }
      : {}),
    ...(typeof cause.retryAt === 'string' ? { retryAt: cause.retryAt } : {}),
  }
}

/** 解析 HTTP Retry-After 头，兼容秒数与绝对时间两种上游返回格式。 */
export function parseRetryAfterHeader(
  retryAfterHeader: string | undefined,
  nowMs = Date.now(),
) {
  const value = retryAfterHeader?.trim()
  if (!value) {
    return undefined
  }

  if (/^\d+$/.test(value)) {
    const retryAfterMs = Number(value) * 1000
    return {
      retryAfterMs,
      retryAt: new Date(nowMs + retryAfterMs).toISOString(),
    }
  }

  const retryAtMs = Date.parse(value)
  if (Number.isNaN(retryAtMs)) {
    return undefined
  }

  const retryAfterMs = Math.max(0, retryAtMs - nowMs)
  return {
    retryAfterMs,
    retryAt: new Date(retryAtMs).toISOString(),
  }
}

// 只读取 Error.cause，避免根据错误消息文本猜测限流语义。
function readCause(error: unknown): Record<string, unknown> | undefined {
  if (!(error instanceof Error)) {
    return undefined
  }
  const cause = error.cause
  return cause && typeof cause === 'object'
    ? (cause as Record<string, unknown>)
    : undefined
}
