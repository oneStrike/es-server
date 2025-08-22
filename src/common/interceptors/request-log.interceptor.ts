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
    const username = user?.username ?? user?.name ?? null
    // 日志内容与扩展构造器
    const buildContent = (status: number, duration: number) =>
      meta.content || `${method} ${url} - ${status} (${duration}ms)`
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
        // 注意：UA 在数据库中限制为 VARCHAR(255)，此处截断避免超长失败
        const __ua = String(req.headers['user-agent'] || '').slice(0, 255)
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
              errorMessage: null,
              userAgent: __ua,
              content: buildContent(statusCode, duration),
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

        const __ua = String(req.headers['user-agent'] || '').slice(0, 255)
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
              errorMessage: String(err?.message || 'Unknown error'),
              userAgent: __ua,
              content: buildContent(statusCode, duration),
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
