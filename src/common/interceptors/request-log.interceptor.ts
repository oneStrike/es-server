import type { FastifyReply, FastifyRequest } from 'fastify'
import { Buffer } from 'node:buffer'
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import {
  REQUEST_LOG_META_KEY,
  RequestLogOptions,
} from '@/common/decorators/request-log.decorator'
import { PrismaService } from '@/global/services/prisma.service'

/**
 * 任意键值对
 */
type AnyObj = Record<string, any>

/**
 * 生成请求追踪 ID（用于链路追踪、日志关联）
 */
function genTraceId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 从请求头和连接中解析客户端 IP
 * 优先级：x-forwarded-for -> x-real-ip -> Fastify 提供的 ip
 */
function getClientIp(request: FastifyRequest): string {
  const xForwardedFor = request.headers['x-forwarded-for']
  if (typeof xForwardedFor === 'string') {
    return xForwardedFor.split(',')[0].trim()
  }
  if (Array.isArray(xForwardedFor)) {
    return xForwardedFor[0]?.split(',')[0]?.trim() || 'unknown'
  }
  return (
    request.headers['x-real-ip']?.toString() || (request as any).ip || 'unknown'
  )
}

/**
 * 根据 URL 粗略判定用户类型（仅用于日志分组展示）
 */
function detectUserType(url: string): string {
  if (url.startsWith('/api/admin')) {
    return 'admin'
  }
  if (url.startsWith('/api/client')) {
    return 'client'
  }
  return 'system'
}

/**
 * 遍历对象，对敏感字段进行脱敏
 * - 大小写不敏感匹配
 * - 嵌套结构、数组均会递归处理
 * - 增加最大深度与数组长度限制，防止深层/大数组拖垮性能
 */
function maskObject(
  obj: any,
  maskKeys: string[] = [],
  maxDepth = 4,
  maxArrayLength = 100,
): any {
  const set = new Set(maskKeys.map((k) => String(k).toLowerCase()))
  const dfs = (o: any, depth: number): any => {
    if (o === null || o === undefined) {
      return o
    }
    if (typeof o !== 'object') {
      return o
    }
    if (depth >= maxDepth) {
      return '[depth_exceeded]'
    }
    if (Array.isArray(o)) {
      return o.slice(0, maxArrayLength).map((v) => dfs(v, depth + 1))
    }
    const r: AnyObj = {}
    for (const [k, v] of Object.entries(o)) {
      if (set.has(k.toLowerCase())) {
        r[k] = '[REDACTED]'
      } else if (typeof v === 'object') {
        r[k] = dfs(v, depth + 1)
      } else {
        r[k] = v
      }
    }
    return r
  }
  return dfs(obj, 0)
}

/**
 * 将对象序列化长度裁剪到指定阈值，避免日志爆量
 * - 长度以内返回原对象
 * - 超长返回预览结构
 */
function truncateJson(obj: any, maxLen = 4096): any {
  try {
    const str = JSON.stringify(obj)
    if (str.length <= maxLen) {
      return obj
    }
    return { _truncated: true, preview: `${str.slice(0, maxLen)}…[truncated]` }
  } catch {
    return '[unserializable]'
  }
}

/**
 * 解析设备信息（基于 User-Agent + Client Hints，轻量实现）
 * 返回尽量稳定且简洁的结构，避免 JSON 膨胀
 */
function parseUserAgentDevice(
  uaRaw: string,
  headers: Record<string, any> = {},
): Record<string, any> {
  const ua = String(uaRaw || '')
  const ual = ua.toLowerCase()
  const trunc = (s?: string | null, n = 64) =>
    s == null ? null : String(s).slice(0, n)

  // Client Hints（可选）
  const chUa = headers['sec-ch-ua'] as string | undefined
  const chPlatform = headers['sec-ch-ua-platform'] as string | undefined
  const chMobile = headers['sec-ch-ua-mobile'] as string | undefined
  const chModel = headers['sec-ch-ua-model'] as string | undefined

  const brands: Array<{ brand: string, version: string }> = []
  if (chUa) {
    const re = /"([^"]+)"\s*;\s*v="([^"]+)"/g
    for (let m = re.exec(chUa); m !== null; m = re.exec(chUa)) {
      brands.push({ brand: trunc(m[1]) || '', version: trunc(m[2]) || '' })
    }
  }

  // 简易 bot 检测
  const isBot =
    /bot|spider|crawler|bingpreview|google|duckduckbot|baiduspider|sogou|360spider|yisouspider/.test(
      ual,
    )

  // 平台/设备类型判定
  const isIpad = /ipad/.test(ual)
  const isTablet =
    isIpad || (/android/.test(ual) && !/mobile/.test(ual)) || /tablet/.test(ual)
  const isMobile = /iphone|ipod|android.*mobile|mobile/.test(ual)
  const deviceType = isBot
    ? 'bot'
    : isTablet
      ? 'tablet'
      : isMobile
        ? 'mobile'
        : 'desktop'

  // OS 识别
  let osName: string | null = null
  let osVersion: string | null = null
  if (/windows nt/.test(ual)) {
    osName = 'Windows'
    const m = /windows nt ([0-9_.]+)/.exec(ual)
    osVersion = m?.[1]?.replace(/_/g, '.') || null
  } else if (/android/.test(ual)) {
    osName = 'Android'
    const m = /android ([0-9_.]+)/.exec(ual)
    osVersion = m?.[1]?.replace(/_/g, '.') || null
  } else if (/iphone|ipad|ipod|ios/.test(ual)) {
    osName = isIpad ? 'iPadOS' : 'iOS'
    const m = /(?:cpu (?:iphone )?os|ios) [0-9_]+/.exec(ual)
    osVersion = m?.[2]?.replace(/_/g, '.') || null
  } else if (/mac os x/.test(ual)) {
    osName = 'macOS'
    const m = /mac os x ([0-9_.]+)/.exec(ual)
    osVersion = m?.[1]?.replace(/_/g, '.') || null
  } else if (/linux/.test(ual)) {
    osName = 'Linux'
  }

  // 浏览器识别（常见主流）
  let browserName: string | null = null
  let browserVersion: string | null = null
  if (/edg\//.test(ual)) {
    browserName = 'Edge'
    const m = /edg\/([0-9.]+)/.exec(ual)
    browserVersion = m?.[1] || null
  } else if (/opr\//.test(ual)) {
    browserName = 'Opera'
    const m = /opr\/([0-9.]+)/.exec(ual)
    browserVersion = m?.[1] || null
  } else if (/chrome\//.test(ual)) {
    browserName = 'Chrome'
    const m = /chrome\/([0-9.]+)/.exec(ual)
    browserVersion = m?.[1] || null
  } else if (/safari\//.test(ual) && /version\//.test(ual)) {
    browserName = 'Safari'
    const m = /version\/([0-9.]+)/.exec(ual)
    browserVersion = m?.[1] || null
  } else if (/firefox\//.test(ual)) {
    browserName = 'Firefox'
    const m = /firefox\/([0-9.]+)/.exec(ual)
    browserVersion = m?.[1] || null
  } else if (/msie |trident\//.test(ual)) {
    browserName = 'IE'
    const m = /(?:msie |rv:)[0-9.]+/.exec(ual)
    browserVersion = m?.[2] || null
  }

  return {
    type: deviceType,
    isMobile,
    isTablet,
    isBot,
    os: {
      name: trunc(osName),
      version: trunc(osVersion),
    },
    browser: {
      name: trunc(browserName),
      version: trunc(browserVersion),
    },
    clientHints: {
      brands: brands.slice(0, 5),
      platform: trunc(chPlatform?.replace(/"/g, '').replace(/"/g, '')),
      model: trunc(chModel?.replace(/"/g, '').replace(/"/g, '')),
      mobile: chMobile ? chMobile.includes('1') : undefined,
    },
  }
}

@Injectable()
/**
 * 请求日志拦截器
 * - 通过装饰器 @RequestLog 控制开关、采样率、脱敏字段等
 * - 使用 Prisma 异步写入 request_log 表（fire-and-forget，避免阻塞请求）
 * - 注意：为避免错误“被吞”，在写入 Promise 后追加 catch 输出错误
 */
export class RequestLogInterceptor implements NestInterceptor {
  /**
   * 默认脱敏字段（可被装饰器追加字段覆盖）
   */
  private readonly defaultMaskKeys = [
    'authorization',
    'cookie',
    'x-api-key',
    'password',
    'token',
    'secret',
    'key',
  ]

  private readonly logger = new Logger(RequestLogInterceptor.name)
  private lastErrTs = 0

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // 仅处理 HTTP 场景
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const handler = context.getHandler()
    const controller = context.getClass()
    // 读取控制器/方法的元数据（方法优先于控制器）
    const meta = this.reflector.getAllAndOverride<
      (RequestLogOptions & { enabled?: boolean }) | undefined
    >(REQUEST_LOG_META_KEY, [handler, controller])

    // 未显式开启则跳过
    if (!meta?.enabled) {
      return next.handle()
    }

    const http = context.switchToHttp()
    const req = http.getRequest<FastifyRequest & AnyObj>()
    const res = http.getResponse<FastifyReply & AnyObj>()

    const start = Date.now()
    const method = req.method
    const url = req.url
    // 追踪 ID：优先使用上游传入，其次本地生成
    const traceIdHeader = String(req.headers['x-request-id'] || '')
    const traceId = traceIdHeader || genTraceId()
    // 将 traceId 回写到响应头，便于前后端对齐排查
    if (typeof (res as any).header === 'function') {
      ;(res as any).header('x-request-id', traceId)
    }

    const userType = detectUserType(url)
    const ip = getClientIp(req) // 缓存 IP，避免重复解析

    // 预先解析 UA 与设备信息，供后续成功/失败两条路径复用
    const uaRaw = String(req.headers['user-agent'] || '')
    const __ua = uaRaw.slice(0, 255) // 数据库 userAgent 限长
    const deviceInfo = parseUserAgentDevice(uaRaw, req.headers as AnyObj)

    // 脱敏字段：装饰器自定义 + 默认字段
    const maskKeys = Array.from(
      new Set([...(meta.maskKeys || []), ...this.defaultMaskKeys]),
    )

    // Content-Type 判定（避免对二进制/大体做 JSON 序列化）
    const ct = String(req.headers['content-type'] || '')
    const isBinaryLike =
      /multipart\/form-data|application\/octet-stream|image\/|video\/|audio\/|application\/zip|application\/pdf/i.test(
        ct,
      )
    // 采集并脱敏请求相关数据（限制体积）
    const safeQuery = truncateJson(maskObject(req.query, maskKeys), 2048)
    const safeBody = isBinaryLike
      ? { _omitted: true, reason: 'binary_like', contentType: ct }
      : truncateJson(maskObject(req.body, maskKeys), 4096)
    const safeParams = truncateJson(maskObject(req.params, maskKeys), 1024)
    const safeHeaders = truncateJson(
      maskObject(
        {
          ...req.headers,
          authorization: undefined,
          cookie: undefined,
        },
        maskKeys,
      ),
      2048,
    )
    const paramsPayload = {
      query: safeQuery,
      body: safeBody,
      params: safeParams,
    }
    // 用户信息（按常见字段兼容提取）
    const user: AnyObj = (req as AnyObj).user || {}
    const userId = user?.id ?? user?.userId ?? null
    let username = user?.username ?? user?.name ?? null
    if (url.includes('/user/user-login')) {
      username = safeBody.username
    }
    // 日志扩展构造器
    const buildExtras = (data: any) => {
      const extras: AnyObj = {
        requestId: traceId,
        headers: safeHeaders,
      }
      if (meta.logResponse) {
        // 可选记录响应数据，限制体积
        const resp: any = data
        const isRespBinary =
          Buffer.isBuffer(resp) ||
          resp instanceof Uint8Array ||
          (resp && typeof resp.pipe === 'function')
        extras.response = isRespBinary
          ? { _omitted: true, reason: 'binary_like' }
          : truncateJson(resp, 4096)
      }
      return extras
    }

    // 通过 RxJS 在响应成功/异常时机写日志（异步，不阻塞请求）
    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - start
        const statusCode = (res as any).statusCode ?? 200
        // Fire-and-forget：为避免阻塞主流程，不 await
        void this.prisma.requestLog
          .create({
            data: {
              userId,
              username,
              userType,
              ip,
              method,
              path: url,
              params: paramsPayload,
              statusCode,
              actionType: meta.actionType || null,
              isSuccess: true,
              userAgent: __ua,
              device: deviceInfo,
              content: '请求成功',
              extras: buildExtras(data),
              traceId,
              responseTimeMs: duration,
            },
          })
          .catch((err) => {
            // 避免错误被吞，便于定位数据库写入失败问题（如字段长度、约束等）
            const now = Date.now()
            if (now - this.lastErrTs > 2000) {
              this.logger.error(
                '[RequestLog] create failed',
                err instanceof Error ? err.stack : String(err),
              )
              this.lastErrTs = now
            }
          })
      }),
      catchError((err) => {
        const duration = Date.now() - start
        let statusCode = (res as any).statusCode || 500
        // 兼容 HttpException 等对象的 getStatus
        const e: any = err
        if (e && typeof e.getStatus === 'function') {
          try {
            statusCode = e.getStatus()
          } catch {}
        }

        void this.prisma.requestLog
          .create({
            data: {
              userId,
              username,
              userType,
              ip,
              method,
              path: url,
              params: paramsPayload,
              statusCode,
              actionType: meta.actionType || null,
              isSuccess: false,
              userAgent: __ua,
              device: deviceInfo,
              content: String(err?.message || 'Unknown error'),
              extras: buildExtras({ error: err?.message }),
              traceId,
              responseTimeMs: duration,
            },
          })
          .catch((e2) => {
            const now = Date.now()
            if (now - this.lastErrTs > 2000) {
              this.logger.error(
                '[RequestLog] create failed',
                e2 instanceof Error ? e2.stack : String(e2),
              )
              this.lastErrTs = now
            }
          })

        // 继续抛出错误，交由全局异常过滤器处理响应
        throw err
      }),
    )
  }
}
