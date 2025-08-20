import type { RequestContextData } from './request-log.types'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

/**
 * 轻量 UA 解析（避免引入大体积库），仅粗略识别
 */
function parseUserAgent(ua?: string | string[]): Record<string, any> | null {
  if (!ua) {
    return null
  }
  const s = Array.isArray(ua) ? ua[0] : ua
  const out: Record<string, any> = {}
  if (/mobile/i.test(s)) {
    out.deviceType = 'mobile'
  }
  if (/tablet|ipad/i.test(s)) {
    out.deviceType = out.deviceType || 'tablet'
  }
  if (/windows nt/i.test(s)) {
    out.os = 'Windows'
  } else if (/android/i.test(s)) {
    out.os = 'Android'
  } else if (/iphone|ios/i.test(s)) {
    out.os = 'iOS'
  } else if (/mac os x/i.test(s)) {
    out.os = 'macOS'
  } else if (/linux/i.test(s)) {
    out.os = 'Linux'
  }

  if (/chrome\/\d+/i.test(s)) {
    out.browser = 'Chrome'
  } else if (/safari\/\d+/i.test(s)) {
    out.browser = out.browser || 'Safari'
  } else if (/firefox\/\d+/i.test(s)) {
    out.browser = 'Firefox'
  } else if (/edg\/\d+/i.test(s)) {
    out.browser = 'Edge'
  } else if (/msie|trident/i.test(s)) {
    out.browser = 'IE'
  }

  out.raw = s
  return out
}

/**
 * 请求上下文存取（基于 AsyncLocalStorage）
 * 避免在调用方手动传递冗余参数
 */
export class RequestContextStorage {
  private static als = new AsyncLocalStorage<RequestContextData>()

  static run(
    init: Omit<RequestContextData, 'traceId' | 'startAt'> & {
      traceId?: string
      startAt?: number
    },
    cb: () => void,
  ) {
    const store: RequestContextData = {
      traceId: init.traceId || randomUUID().replace(/-/g, ''),
      startAt: init.startAt ?? Date.now(),
      method: init.method,
      path: init.path,
      ip: init.ip,
      userAgent: init.userAgent,
      device:
        init.device ?? (init.userAgent ? parseUserAgent(init.userAgent) : null),
      params: init.params ?? null,
      userId: init.userId ?? null,
      userType: init.userType ?? null,
      statusCode: init.statusCode ?? null,
      responseTimeMs: init.responseTimeMs ?? null,
    }
    this.als.run(store, cb)
  }

  static get(): RequestContextData | undefined {
    return this.als.getStore()
  }

  static setUser(userId: number | null, userType?: string | null) {
    const store = this.als.getStore()
    if (store) {
      store.userId = userId
      if (userType !== undefined) {
        store.userType = userType
      }
    }
  }

  static setParams(params: Record<string, any> | null) {
    const store = this.als.getStore()
    if (store) {
      store.params = params
    }
  }

  static setResponse(
    statusCode?: number | null,
    responseTimeMs?: number | null,
  ) {
    const store = this.als.getStore()
    if (store) {
      if (typeof statusCode === 'number') {
        store.statusCode = statusCode
      }
      if (typeof responseTimeMs === 'number') {
        store.responseTimeMs = responseTimeMs
      }
    }
  }
}

/**
 * 从 Fastify/Nest 请求中提取基础上下文
 */
export function buildInitialContext(
  req: any,
): Omit<RequestContextData, 'traceId' | 'startAt'> {
  const method = req?.method || 'GET'
  const path = req?.url || req?.originalUrl || req?.raw?.url || '/'
  const ip =
    req?.ip ||
    (req?.headers?.['x-forwarded-for'] as string) ||
    (req?.headers?.['x-real-ip'] as string) ||
    (req?.raw?.socket?.remoteAddress as string) ||
    undefined
  const ua = (req?.headers?.['user-agent'] as string) || undefined
  const params = {
    query: req?.query ?? null,
    body: req?.body ?? null,
  }
  return {
    method,
    path,
    ip,
    userAgent: ua,
    device: ua ? parseUserAgent(ua) : null,
    params,
    userId: null,
    userType: null,
    statusCode: null,
    responseTimeMs: null,
  }
}
