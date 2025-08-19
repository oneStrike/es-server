import type { FastifyRequest } from 'fastify'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/global/services/prisma.service'
import { Prisma, SystemRequestLog } from '@/prisma/client/client'

type Primitive = string | number | boolean | null | undefined

export type RequestLogOverrides = Partial<Pick<SystemRequestLog, 'username' |
  'userId' |
  'ipAddress' |
  'ipLocation' |
  'module' |
  'responseCode' |
  'httpMethod' |
  'requestPath' |
  'operationDescription' |
  'duration' |
  'userAgent' |
  'requestParams'>>

export interface RequestLogOptions {
  // 推荐传入：便于自动采集字段；若为空则仅依赖 overrides
  req?: FastifyRequest
  // 响应状态码（可直接设置，若未提供则从 reply/req 中尝试推断，最后默认 200/500 由调用方保证）
  responseCode?: number
  // 本次业务含义说明（数据库字段 operationDescription）
  operationDescription?: string
  // 请求耗时（毫秒）
  duration?: number
  // 日志模块（ADMIN | CLIENT | GLOBAL），不传则自动按路径识别
  module?: string
  // 附加元数据，将与请求参数合并后写入 requestParams(JSON)
  extraMeta?: Record<string, any>
  // 允许覆盖任何自动采集字段
  overrides?: RequestLogOverrides
  // 明确的请求参数对象（优先级：此参数 > 从 req 自动采集的 params/query/body）
  requestParamsObj?: Record<string, any> | Primitive
}

@Injectable()
export class RequestLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 手动记录请求日志
   * - 自动采集除 responseMessage 外的所有字段
   * - responseMessage 由调用方显式传入
   * - 调用方可通过 overrides 覆盖任何字段
   * - 调用方可通过 extraMeta 附加元数据
   */
  async log(responseMessage: string, options: RequestLogOptions = {}): Promise<void> {
    const {
      req,
      responseCode,
      operationDescription,
      duration,
      module,
      overrides,
      extraMeta,
      requestParamsObj,
    } = options

    // 1) 自动采集
    const auto = this.buildAutoFields(req)

    // 2) 计算 requestParams：将参数与 extraMeta 合并后序列化
    const requestParams = this.buildRequestParams(req, requestParamsObj, extraMeta, overrides?.requestParams)

    // 3) 组装最终 payload，overrides 优先
    const payload = {
      // required/important
      responseMessage,
      responseCode: this.ensureInt(this.pickFirst(overrides?.responseCode, responseCode, auto.responseCode, 200) ?? 200),
      httpMethod: this.pickFirst(overrides?.httpMethod, auto.httpMethod, 'UNKNOWN') || 'UNKNOWN',
      requestPath: this.pickFirst(overrides?.requestPath, auto.requestPath, 'UNKNOWN') || 'UNKNOWN',
      duration: this.ensureInt(this.pickFirst(overrides?.duration, duration, auto.duration, 0) ?? 0),
      ipAddress: this.pickFirst(overrides?.ipAddress, auto.ipAddress, 'unknown') || 'unknown',
      ipLocation: this.pickFirst(overrides?.ipLocation, auto.ipLocation, '') || '',
      userAgent: this.pickFirst(overrides?.userAgent, auto.userAgent, '') || '',
      module: this.pickFirst(overrides?.module, module, auto.module, 'GLOBAL') || 'GLOBAL',
      // optional
      username: this.pickFirst(overrides?.username, auto.username),
      userId: this.toNullableInt(this.pickFirst(overrides?.userId, auto.userId)),
      operationDescription: this.pickFirst(overrides?.operationDescription, operationDescription, auto.operationDescription, '') || '',
      requestParams: this.pickFirst(overrides?.requestParams, requestParams),
    } as const

    // 4) 写入数据库
    const data: Prisma.SystemRequestLogCreateInput = {
      username: payload.username ?? null,
      userId: payload.userId ?? null,
      ipAddress: payload.ipAddress,
      ipLocation: payload.ipLocation,
      module: payload.module,
      responseCode: payload.responseCode,
      responseMessage: payload.responseMessage,
      httpMethod: payload.httpMethod,
      requestPath: payload.requestPath,
      operationDescription: payload.operationDescription,
      duration: payload.duration,
      userAgent: payload.userAgent,
      requestParams: payload.requestParams ?? null,
    }
    await this.prisma.systemRequestLog.create({ data })
  }

  // ================== helpers ==================

  private buildAutoFields(req?: FastifyRequest) {
    if (!req) {
      return {
        username: undefined as string | undefined,
        userId: undefined as number | undefined,
        ipAddress: 'unknown',
        ipLocation: '', // 若有 IP 库，可在调用前通过 overrides.ipLocation 写入
        module: 'GLOBAL',
        responseCode: undefined as number | undefined,
        httpMethod: 'UNKNOWN',
        requestPath: 'UNKNOWN',
        operationDescription: '',
        duration: 0,
        userAgent: '',
      }
    }

    const ip = this.getClientIp(req)
    const userId = (req as any)?.user?.id as number | undefined
    const username = (req as any)?.user?.username as string | undefined
    const ua = req.headers['user-agent']?.toString() || ''
    const method = req.method || 'UNKNOWN'
    const path = req.url || 'UNKNOWN'

    // responseCode 不一定可从 req 拿到，留给调用方传入
    return {
      username,
      userId,
      ipAddress: ip,
      ipLocation: '',
      module: this.getModuleFromPath(path),
      responseCode: undefined,
      httpMethod: method,
      requestPath: path,
      operationDescription: '',
      duration: 0,
      userAgent: ua,
    }
  }

  private getClientIp(request: FastifyRequest): string {
    const xff = request.headers['x-forwarded-for']
    if (typeof xff === 'string') {
      return xff.split(',')[0].trim()
    }
    if (Array.isArray(xff)) {
      return xff[0]?.split(',')[0]?.trim() || 'unknown'
    }
    return request.headers['x-real-ip']?.toString() || request.ip || 'unknown'
  }

  private getModuleFromPath(path?: string): string {
    if (!path) {
      return 'GLOBAL'
    }
    if (path.startsWith('/api/admin')) {
      return 'ADMIN'
    }
    if (path.startsWith('/api/client')) {
      return 'CLIENT'
    }
    return 'GLOBAL'
  }

  private buildRequestParams(
    req: FastifyRequest | undefined,
    explicitParams: RequestLogOptions['requestParamsObj'],
    extraMeta?: Record<string, any>,
    overrideRequestParams?: string | null,
  ): string | null {
    if (typeof overrideRequestParams === 'string' || overrideRequestParams === null) {
      // 完全覆盖：如果调用方在 overrides 直接给了字符串/空，则尊重
      return overrideRequestParams
    }

    // 优先使用显式提供的 params 对象
    const paramsObj: any =
      explicitParams !== undefined
        ? explicitParams
        : req
          ? {
              params: (req as any).params,
              query: (req as any).query,
              body: (req as any).body,
              headers: this.sanitizeHeaders(req.headers || {}),
            }
          : undefined

    const merged = paramsObj !== undefined
      ? { ...this.asPlainObject(paramsObj) }
      : {}

    if (extraMeta && typeof extraMeta === 'object') {
      merged.__meta = extraMeta
    }

    // 如果没有任何内容，返回 null 节省空间
    if (!merged || Object.keys(merged).length === 0) {
      return null
    }

    try {
      return JSON.stringify(merged)
    } catch {
      // 兜底：JSON 序列化失败时降级为字符串
      return String(merged)
    }
  }

  private sanitizeHeaders(headers: Record<string, any>) {
    // 与拦截器一致的敏感字段脱敏
    const sensitive = new Set([
      'authorization',
      'cookie',
      'x-api-key',
      'password',
      'token',
      'secret',
      'key',
    ])
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(headers)) {
      out[k] = sensitive.has(k.toLowerCase()) ? '[REDACTED]' : v
    }
    return out
  }

  private asPlainObject(input: any) {
    if (input === null || input === undefined) {
      return input
    }
    if (typeof input !== 'object') {
      return input
    }
    try {
      return JSON.parse(JSON.stringify(input))
    } catch {
      return input
    }
  }

  private pickFirst<T>(...values: (T | undefined)[]): T | undefined {
    for (const v of values) {
      if (v !== undefined) {
        return v
      }
    }
    return undefined
  }

  private ensureInt(v: any): number {
    const n = Number(v)
    return Number.isFinite(n) ? Math.trunc(n) : 0
  }

  private toNullableInt(v: any): number | null | undefined {
    if (v === undefined) {
      return undefined
    }
    if (v === null) {
      return null
    }
    const n = Number(v)
    return Number.isFinite(n) ? Math.trunc(n) : null
  }
}
