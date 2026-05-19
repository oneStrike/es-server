import type {
  CopyMangaApiFailureCause,
  CopyMangaApiHostCache,
  CopyMangaNetworkResponse,
  CopyMangaTransportError,
} from './copy-manga.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { ThirdPartyResourceThrottleService } from '../services/third-party-resource-throttle.service'
import { parseRetryAfterHeader } from '../third-party-rate-limit'

const COPY_MANGA_DEFAULT_API_HOST = 'api.2024manga.com'
const COPY_MANGA_DISCOVERY_PATH = '/api/v3/system/network2'
const COPY_MANGA_PLATFORM = 3
const COPY_MANGA_REQUEST_ATTEMPTS = 5
const COPY_MANGA_VERSION = '2024.4.28'
const COPY_MANGA_REQUEST_TIMEOUT_MS = 20000

@Injectable()
export class CopyMangaHttpClient {
  private apiHostCache: CopyMangaApiHostCache | null = null

  // 注入三方资源解析节流器，统一控制 discovery 和业务 API 节奏。
  constructor(private readonly throttle: ThirdPartyResourceThrottleService) {}

  // 读取 host 缓存或在缓存失效后重新发现，发现失败时不继续请求内容 API。
  async getJson<TPayload = unknown>(
    path: string,
    params: Record<string, unknown> = {},
  ): Promise<TPayload> {
    const apiHosts = await this.getApiHosts()

    let lastError: unknown
    for (let attempt = 0; attempt < COPY_MANGA_REQUEST_ATTEMPTS; attempt++) {
      const host = apiHosts[attempt % apiHosts.length]
      try {
        await this.throttle.waitForApiSlot()
      } catch (error) {
        if (error instanceof BusinessException) {
          throw error
        }
        lastError = error
        continue
      }
      try {
        const payload = await this.fetchJson<TPayload>(
          `https://${host}${path}`,
          {
            ...params,
            platform: COPY_MANGA_PLATFORM,
          },
        )
        this.throwIfProviderRateLimited(path, payload)
        return payload
      } catch (error) {
        if (error instanceof BusinessException) {
          throw error
        }
        lastError = error
      }
    }

    this.apiHostCache = null
    throw this.apiRequestError(path, lastError)
  }

  // 复用有效 host 缓存；过期后清空旧缓存再发现，避免失败时回退到过期 host。
  private async getApiHosts() {
    const cached = this.apiHostCache
    if (cached && cached.expiresAt > Date.now()) {
      return cached.hosts
    }

    this.apiHostCache = null
    const hosts = await this.refreshApiHosts()
    this.apiHostCache = {
      expiresAt: Date.now() + this.throttle.getHostCacheTtlMs(),
      hosts,
    }
    return hosts
  }

  // 调用 CopyManga host discovery，并对所有异常/畸形结果执行 fail closed。
  private async refreshApiHosts() {
    let lastError: unknown
    for (let attempt = 0; attempt < COPY_MANGA_REQUEST_ATTEMPTS; attempt++) {
      try {
        await this.throttle.waitForApiSlot()
      } catch (error) {
        if (error instanceof BusinessException) {
          throw error
        }
        lastError = error
        continue
      }
      try {
        const data = await this.fetchJson<CopyMangaNetworkResponse>(
          `https://${COPY_MANGA_DEFAULT_API_HOST}${COPY_MANGA_DISCOVERY_PATH}`,
          {
            platform: COPY_MANGA_PLATFORM,
          },
        )
        this.throwIfProviderRateLimited(COPY_MANGA_DISCOVERY_PATH, data)
        if (data.code !== 200) {
          lastError = new Error(
            data.message || 'CopyManga host discovery failed',
          )
          continue
        }

        const discoveredHosts = this.extractApiHosts(data.results?.api)
        if (discoveredHosts.length === 0) {
          throw this.hostDiscoveryError(
            'CopyManga host discovery returned no hosts',
          )
        }

        return discoveredHosts
      } catch (error) {
        if (error instanceof BusinessException) {
          throw error
        }
        lastError = error
      }
    }

    throw this.hostDiscoveryError(
      `CopyManga host discovery failed: ${this.failureReason(lastError)}`,
    )
  }

  // 读取上游失败原因，优先保留 HTTP 状态码。
  private failureReason(error: unknown) {
    const status = this.readHttpStatus(error)
    if (status !== undefined) {
      return `HTTP ${status}`
    }
    if (error instanceof Error) {
      return error.message
    }
    return 'unknown upstream error'
  }

  // 从 discovery 原始结果提取可用 host，拒绝非二维数组结构。
  private extractApiHosts(api: unknown) {
    if (!Array.isArray(api)) {
      throw this.hostDiscoveryError(
        'CopyManga host discovery payload malformed',
      )
    }

    const hosts = api
      .flat()
      .map((host) => (typeof host === 'string' ? host.trim() : ''))
      .filter((host) => host.length > 0)

    return Array.from(new Set(hosts))
  }

  // 统一 discovery 的可预期失败，避免静默回退到默认或旧 host。
  private hostDiscoveryError(message: string) {
    return new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message,
    )
  }

  // 将内容 API 的网络/HTTP 失败归类为业务错误，避免传输细节泄漏成 500。
  private apiRequestError(path: string, error: unknown) {
    if (error instanceof BusinessException) {
      return error
    }

    const reason = this.failureReason(error)
    const status = this.readHttpStatus(error)

    return new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `CopyManga API 请求失败：${reason} (${path})`,
      {
        cause: this.buildApiRequestErrorCause(path, error, reason, status),
      },
    )
  }

  // 保留上游 HTTP 诊断给 provider 判断，避免依赖错误消息文本分支。
  private buildApiRequestErrorCause(
    path: string,
    error: unknown,
    reason: string,
    status?: number,
  ): CopyMangaApiFailureCause {
    const code = this.readTransportCode(error)
    const retryAfterHeader = this.readRetryAfterHeader(error)
    const rateLimited = this.isRateLimitedFailure(status, code)
    const retryAfter = parseRetryAfterHeader(retryAfterHeader)
    return {
      kind: status === undefined ? 'transport' : 'http',
      path,
      reason,
      routeCandidateRecoverable: rateLimited
        ? false
        : this.isRouteCandidateRecoverable(path, error, status),
      ...(code === undefined ? {} : { code }),
      ...(status === undefined ? {} : { status }),
      ...(rateLimited ? { rateLimited: true as const } : {}),
      ...(retryAfterHeader === undefined ? {} : { retryAfterHeader }),
      ...(retryAfter === undefined ? {} : retryAfter),
    }
  }

  // 从传输错误中提取 HTTP 状态码。
  private readHttpStatus(error: unknown) {
    if (!this.isCopyMangaTransportError(error)) {
      return undefined
    }

    const status = error.response?.status
    return typeof status === 'number' ? status : undefined
  }

  // 读取 fetch/undici 暴露的传输错误码。
  private readTransportCode(error: unknown) {
    if (!(error instanceof Error)) {
      return undefined
    }
    const transportError = error as CopyMangaTransportError
    const causeCode = transportError.cause?.code
    if (typeof causeCode === 'string') {
      return causeCode
    }
    return typeof transportError.code === 'string'
      ? transportError.code
      : undefined
  }

  // 从 HTTP 失败响应中提取 Retry-After，保留上游限流重试建议。
  private readRetryAfterHeader(error: unknown) {
    if (!this.isCopyMangaTransportError(error)) {
      return undefined
    }

    const retryAfterHeader = error.response?.retryAfterHeader
    return typeof retryAfterHeader === 'string' && retryAfterHeader.length > 0
      ? retryAfterHeader
      : undefined
  }

  // 识别 HTTP 与传输层表达的限流失败，阻止继续轮询候选 host。
  private isRateLimitedFailure(status?: number, code?: string) {
    return (
      status === 429 || code === 'RATE_LIMITED' || code === 'TOO_MANY_REQUESTS'
    )
  }

  // 判断失败是否允许 provider 继续尝试下一个章节内容候选路由。
  private isRouteCandidateRecoverable(
    path: string,
    error: unknown,
    status?: number,
  ) {
    if (!this.isChapterContentPath(path)) {
      return false
    }
    if (status === 404) {
      return true
    }
    if (status !== undefined || !this.isFetchStageError(error)) {
      return false
    }
    return this.isRecoverableStatuslessTransportError(error)
  }

  // 只允许章节内容接口进入候选路由 fallback。
  private isChapterContentPath(path: string) {
    return /^\/api\/v3\/comic\/[^/]+\/chapter(?:2|3)?\/[^/]+$/.test(path)
  }

  // 识别无 HTTP 状态的 socket/连接类 fetch 错误，排除 timeout/abort/JSON 解析错误。
  private isRecoverableStatuslessTransportError(error: unknown) {
    if (!(error instanceof Error) || error instanceof SyntaxError) {
      return false
    }
    if (this.isAbortOrTimeoutError(error)) {
      return false
    }

    const code = this.readTransportCode(error)
    return (
      error instanceof TypeError ||
      code === 'UND_ERR_SOCKET' ||
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'EPIPE'
    )
  }

  // 识别 AbortSignal 或 undici timeout，避免把限时失败误当成路由候选失败。
  private isAbortOrTimeoutError(error: Error) {
    const code = this.readTransportCode(error)
    return (
      error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      code === 'ABORT_ERR' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      code === 'UND_ERR_HEADERS_TIMEOUT' ||
      code === 'UND_ERR_BODY_TIMEOUT'
    )
  }

  // 发送 CopyManga JSON 请求，统一保留请求头、超时和 HTTP 失败形状。
  private async fetchJson<TPayload>(
    url: string,
    params: Record<string, unknown>,
  ): Promise<TPayload> {
    try {
      const response = await fetch(this.withParams(url, params), {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(COPY_MANGA_REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) {
        const retryAfterHeader =
          response.headers?.get('retry-after') ?? undefined
        throw Object.assign(new Error(`HTTP ${response.status}`), {
          response: {
            status: response.status,
            ...(retryAfterHeader ? { retryAfterHeader } : {}),
          },
        } satisfies Pick<CopyMangaTransportError, 'response'>)
      }
      return (await response.json()) as TPayload
    } catch (error) {
      if (error instanceof Error) {
        Object.defineProperty(error, 'copyMangaFetchStage', {
          configurable: true,
          value: true,
        })
      }
      throw error
    }
  }

  // 构建 CopyManga 固定请求头，使用普通对象避免 Node/Jest 环境缺失 Headers。
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    headers.accept = 'application/json'
    headers.authorization = 'Token '
    headers.platform = String(COPY_MANGA_PLATFORM)
    headers.version = COPY_MANGA_VERSION
    headers.webp = '1'
    headers['x-requested-with'] = 'com.manga2020.app'
    return headers
  }

  // 按原有 params 序列化语义拼接查询参数，跳过 null/undefined。
  private withParams(url: string, params: Record<string, unknown>) {
    const parsedUrl = new URL(url)
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue
      }
      parsedUrl.searchParams.set(key, String(value))
    }
    return parsedUrl.toString()
  }

  // 识别本 client 生成的 HTTP 传输错误，保持 failureReason 的状态码读取语义。
  private isCopyMangaTransportError(
    error: unknown,
  ): error is CopyMangaTransportError {
    return error instanceof Error && 'response' in error
  }

  // 判断错误是否来自 fetchJson 内部，而不是 throttle/discovery 前置流程。
  private isFetchStageError(error: unknown) {
    return (
      error instanceof Error &&
      (error as { copyMangaFetchStage?: boolean }).copyMangaFetchStage === true
    )
  }

  // 将 provider 业务响应中的限流语义提升为可被 workflow 识别的异常。
  private throwIfProviderRateLimited(path: string, payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      return
    }

    const response = payload as {
      code?: unknown
      message?: unknown
      retry_after?: unknown
      retryAfter?: unknown
    }
    if (!this.isProviderRateLimitPayload(response)) {
      return
    }

    const reason =
      typeof response.message === 'string' && response.message.length > 0
        ? response.message
        : 'CopyManga provider rate limited'
    const code =
      typeof response.code === 'string' || typeof response.code === 'number'
        ? String(response.code)
        : undefined
    const retryAfterHeader = this.readProviderRetryAfterHeader(response)
    const retryAfter = parseRetryAfterHeader(retryAfterHeader)

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `CopyManga API 请求失败：${reason} (${path})`,
      {
        cause: {
          kind: 'provider',
          path,
          reason,
          routeCandidateRecoverable: false,
          rateLimited: true,
          ...(code === undefined ? {} : { code }),
          ...(retryAfterHeader === undefined ? {} : { retryAfterHeader }),
          ...(retryAfter === undefined ? {} : retryAfter),
        } satisfies CopyMangaApiFailureCause,
      },
    )
  }

  // 判断 provider 响应体是否表达限流，而不是普通业务失败。
  private isProviderRateLimitPayload(response: {
    code?: unknown
    message?: unknown
  }) {
    if (
      response.code === 429 ||
      response.code === '429' ||
      response.code === 'RATE_LIMITED' ||
      response.code === 'TOO_MANY_REQUESTS'
    ) {
      return true
    }

    if (typeof response.message !== 'string') {
      return false
    }

    return /rate[-_\s]?limit|too many requests|限流|请求过多|频率/i.test(
      response.message,
    )
  }

  // 读取 provider 响应体中的 retryAfter 字段并统一为 Retry-After 字符串。
  private readProviderRetryAfterHeader(response: {
    retry_after?: unknown
    retryAfter?: unknown
  }) {
    const retryAfter = response.retry_after ?? response.retryAfter
    if (typeof retryAfter === 'number' && Number.isFinite(retryAfter)) {
      return String(retryAfter)
    }
    return typeof retryAfter === 'string' && retryAfter.length > 0
      ? retryAfter
      : undefined
  }
}
