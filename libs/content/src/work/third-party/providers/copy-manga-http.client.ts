import type { LookupAddress } from 'node:dns'
import type { IncomingMessage } from 'node:http'
import type { LookupFunction } from 'node:net'
import type {
  ThirdPartyHostPolicy,
  ThirdPartyProviderPolicy,
} from '../third-party-provider-policy.type'
import type {
  CopyMangaApiFailureCause,
  CopyMangaApiHostCache,
  CopyMangaJsonRequestInput,
  CopyMangaNetworkResponse,
  CopyMangaTransportError,
  CopyMangaValidatedRequestTarget,
} from './copy-manga.type'
import { Buffer } from 'node:buffer'
import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { ConfigReader } from '@libs/system-config/config-reader'
import { Injectable } from '@nestjs/common'
import { ThirdPartyResourceThrottleService } from '../services/third-party-resource-throttle.service'
import { parseRetryAfterHeader } from '../third-party-rate-limit'

const COPY_MANGA_DEFAULT_API_HOST = 'api.2024manga.com'
const COPY_MANGA_DISCOVERY_PATH = '/api/v3/system/network2'
const COPY_MANGA_PLATFORM = 3
const COPY_MANGA_REQUEST_ATTEMPTS = 5
const COPY_MANGA_VERSION = '2024.4.28'
const COPY_MANGA_REQUEST_TIMEOUT_MS = 20000
const COPY_MANGA_JSON_RESPONSE_MAX_BYTES = 5 * 1024 * 1024

@Injectable()
export class CopyMangaHttpClient {
  private apiHostCache: CopyMangaApiHostCache | null = null

  // 注入三方资源解析节流器，统一控制 discovery 和业务 API 节奏。
  constructor(
    private readonly throttle: ThirdPartyResourceThrottleService,
    private readonly configReader: ConfigReader,
  ) {}

  // 读取 host 缓存或在缓存失效后重新发现，发现失败时不继续请求内容 API。
  async getJson<TPayload = unknown>(
    path: string,
    params: Record<string, unknown> = {},
    providerPolicy: ThirdPartyProviderPolicy,
  ): Promise<TPayload> {
    const apiHosts = await this.getApiHosts(providerPolicy)

    let lastError: unknown
    for (let attempt = 0; attempt < COPY_MANGA_REQUEST_ATTEMPTS; attempt++) {
      const host = apiHosts[attempt % apiHosts.length]
      try {
        await this.throttle.waitForApiSlot(providerPolicy.throttle.apiChannel)
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
          providerPolicy.apiHostPolicy,
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
  private async getApiHosts(providerPolicy: ThirdPartyProviderPolicy) {
    const cached = this.apiHostCache
    if (cached && cached.expiresAt > Date.now()) {
      return cached.hosts
    }

    this.apiHostCache = null
    const hosts = await this.refreshApiHosts(providerPolicy)
    this.apiHostCache = {
      expiresAt: Date.now() + this.throttle.getHostCacheTtlMs(),
      hosts,
    }
    return hosts
  }

  // 调用 CopyManga host discovery，并对所有异常/畸形结果执行 fail closed。
  private async refreshApiHosts(providerPolicy: ThirdPartyProviderPolicy) {
    let lastError: unknown
    for (let attempt = 0; attempt < COPY_MANGA_REQUEST_ATTEMPTS; attempt++) {
      try {
        await this.throttle.waitForApiSlot(providerPolicy.throttle.apiChannel)
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
          providerPolicy.apiHostPolicy,
        )
        this.throwIfProviderRateLimited(COPY_MANGA_DISCOVERY_PATH, data)
        if (data.code !== 200) {
          lastError = new Error(
            data.message || 'CopyManga host discovery failed',
          )
          continue
        }

        const discoveredHosts = this.extractApiHosts(
          data.results?.api,
          providerPolicy.apiHostPolicy,
        )
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
  private extractApiHosts(api: unknown, hostPolicy: ThirdPartyHostPolicy) {
    if (!Array.isArray(api)) {
      throw this.hostDiscoveryError(
        'CopyManga host discovery payload malformed',
      )
    }

    const hosts = api
      .flat()
      .map((host) => {
        if (typeof host !== 'string') {
          throw this.hostDiscoveryError(
            'CopyManga host discovery returned non-string host',
          )
        }
        return this.normalizeDiscoveredApiHost(host, hostPolicy)
      })
      .filter((host) => host.length > 0)

    return Array.from(new Set(hosts))
  }

  // 将 discovery 返回值收敛为纯 hostname；URL、路径、端口和非白名单 host 均失败关闭。
  private normalizeDiscoveredApiHost(
    host: string,
    hostPolicy: ThirdPartyHostPolicy,
  ) {
    const candidate = host.trim().toLowerCase()
    if (!candidate) {
      return ''
    }
    if (/[/?#@]/.test(candidate)) {
      throw this.hostDiscoveryError(
        'CopyManga host discovery returned URL-like host',
      )
    }
    if (!hostPolicy.allowPort && candidate.includes(':')) {
      throw this.hostDiscoveryError(
        'CopyManga host discovery returned host with port',
      )
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(`https://${candidate}`)
    } catch {
      throw this.hostDiscoveryError(
        'CopyManga host discovery returned invalid host',
      )
    }
    if (
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.pathname !== '/' ||
      parsedUrl.search ||
      parsedUrl.hash ||
      (!hostPolicy.allowPort && parsedUrl.port)
    ) {
      throw this.hostDiscoveryError(
        'CopyManga host discovery returned unsafe host',
      )
    }

    const hostname = parsedUrl.hostname.toLowerCase()
    if (!this.isAllowedHost(hostname, hostPolicy)) {
      throw this.hostDiscoveryError(
        'CopyManga host discovery returned disallowed host',
      )
    }
    return hostname
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

  // 发送 CopyManga JSON 请求，统一保留请求头、超时和 HTTP 失败形状。
  private async fetchJson<TPayload>(
    url: string,
    params: Record<string, unknown>,
    hostPolicy: ThirdPartyHostPolicy,
  ): Promise<TPayload> {
    const target = await this.toSafeRequestTarget(
      this.withParams(url, params),
      hostPolicy,
    )
    return this.requestJson<TPayload>({
      url: target.url,
      address: target.address,
      headers: this.buildHeaders(),
    })
  }

  // 校验 CopyManga API 请求目标，并把 DNS 结果固定到后续 HTTPS 连接。
  private async toSafeRequestTarget(
    url: string,
    hostPolicy: ThirdPartyHostPolicy,
  ): Promise<CopyMangaValidatedRequestTarget> {
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol !== 'https:') {
      throw this.transportError('CopyManga API must use HTTPS')
    }
    if (!hostPolicy.allowPort && parsedUrl.port) {
      throw this.transportError('CopyManga API host must not include port')
    }
    if (!this.isAllowedHost(parsedUrl.hostname, hostPolicy)) {
      throw this.transportError('CopyManga API host is not allowed')
    }

    const addresses = await lookup(parsedUrl.hostname, { all: true })
    if (addresses.length === 0) {
      throw this.transportError('CopyManga API host resolved no addresses')
    }
    if (
      this.isAddressGuardEnabled() &&
      addresses.some((address) => this.isUnsafeAddress(address.address))
    ) {
      throw this.transportError('CopyManga API host resolved unsafe address')
    }

    return {
      url: parsedUrl,
      address: addresses[0],
    }
  }

  // 使用原生 HTTPS 请求发送 JSON 请求，默认不跟随任何重定向。
  private async requestJson<TPayload>(
    input: CopyMangaJsonRequestInput,
  ): Promise<TPayload> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let totalBytes = 0
      const request = httpsRequest(
        input.url,
        {
          headers: input.headers,
          lookup: this.createPinnedLookup(input.url.hostname, input.address),
          method: 'GET',
        },
        (response) => {
          if (this.isRedirectResponse(response)) {
            response.resume()
            reject(this.buildHttpTransportError(response))
            return
          }

          response.on('data', (chunk: Buffer) => {
            totalBytes += chunk.length
            if (totalBytes > COPY_MANGA_JSON_RESPONSE_MAX_BYTES) {
              request.destroy(
                Object.assign(new Error('CopyManga API response too large'), {
                  code: 'PAYLOAD_TOO_LARGE',
                }),
              )
              return
            }
            chunks.push(chunk)
          })
          response.on('end', () => {
            if (!this.isSuccessfulResponse(response)) {
              reject(this.buildHttpTransportError(response))
              return
            }
            try {
              resolve(
                JSON.parse(Buffer.concat(chunks).toString('utf8')) as TPayload,
              )
            } catch (error) {
              reject(error)
            }
          })
          response.on('error', reject)
        },
      )

      request.setTimeout(COPY_MANGA_REQUEST_TIMEOUT_MS, () => {
        request.destroy(
          Object.assign(
            new Error(`timeout of ${COPY_MANGA_REQUEST_TIMEOUT_MS}ms exceeded`),
            { code: 'ETIMEDOUT' },
          ),
        )
      })
      request.on('error', reject)
      request.end()
    })
  }

  // 只允许 2xx JSON 响应，其余 HTTP 状态统一按传输错误归类。
  private isSuccessfulResponse(response: IncomingMessage) {
    const statusCode = response.statusCode ?? 0
    return statusCode >= 200 && statusCode < 300
  }

  // 重定向在本批次固定失败关闭，不做手动跳转。
  private isRedirectResponse(response: IncomingMessage) {
    const statusCode = response.statusCode ?? 0
    return statusCode >= 300 && statusCode < 400
  }

  // 将 HTTP 失败转换为 provider 可读取的 transport error 形状。
  private buildHttpTransportError(response: IncomingMessage) {
    const status = response.statusCode ?? 0
    const retryAfterHeader = this.readResponseRetryAfterHeader(response)
    return Object.assign(new Error(`HTTP ${status}`), {
      response: {
        status,
        ...(retryAfterHeader ? { retryAfterHeader } : {}),
      },
    } satisfies Pick<CopyMangaTransportError, 'response'>)
  }

  // 读取原生响应上的 Retry-After 头。
  private readResponseRetryAfterHeader(response: IncomingMessage): string | undefined {
    const header = response.headers['retry-after'] as string | string[] | undefined
    return Array.isArray(header) ? header[0] : header
  }

  // 构造 API 请求传输错误，保留 code 供 workflow 诊断。
  private transportError(message: string) {
    return Object.assign(new Error(message), {
      code: 'COPY_MANGA_SAFE_REQUEST_REJECTED',
    })
  }

  // 判断请求 host 是否命中 provider 声明的精确 host 或子域后缀。
  private isAllowedHost(hostname: string, hostPolicy: ThirdPartyHostPolicy) {
    const normalizedHostname = hostname.toLowerCase()
    if (
      hostPolicy.allowedExactHosts
        .map((host) => host.toLowerCase())
        .includes(normalizedHostname)
    ) {
      return true
    }

    return hostPolicy.allowedHostSuffixes.some((suffix) => {
      const normalizedSuffix = suffix.replace(/^\./, '').toLowerCase()
      return normalizedHostname.endsWith(`.${normalizedSuffix}`)
    })
  }

  // 读取系统安全配置，决定是否拒绝特殊用途 IP 地址。
  private isAddressGuardEnabled() {
    return this.configReader.getRemoteImageImportSecurityConfig()
      .enableAddressGuard
  }

  // 为原生请求固定已验证地址，避免校验后再次进行不受控 DNS 解析。
  private createPinnedLookup(
    expectedHostname: string,
    address: LookupAddress,
  ): LookupFunction {
    return (hostname, options, callback) => {
      if (hostname !== expectedHostname) {
        callback(
          Object.assign(new Error('CopyManga API 请求域名与校验域名不一致'), {
            code: 'ERR_COPY_MANGA_API_HOST_CHANGED',
          }),
          '',
          0,
        )
        return
      }

      if (options.all) {
        callback(null, [address])
        return
      }

      callback(null, address.address, address.family)
    }
  }

  // 判断 DNS 地址是否落入内网、环回、链路本地、多播或保留地址段。
  private isUnsafeAddress(address: string) {
    switch (isIP(address)) {
      case 4:
        return this.isUnsafeIpv4Address(address)
      case 6:
        return this.isUnsafeIpv6Address(address)
      default:
        return true
    }
  }

  // 判断 IPv4 地址是否属于不允许服务端访问的地址段。
  private isUnsafeIpv4Address(address: string) {
    const parts = address.split('.').map((part) => Number(part))
    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return true
    }

    const [a, b, c] = parts
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    )
  }

  // 判断 IPv6 地址是否属于不允许服务端访问的地址段。
  private isUnsafeIpv6Address(address: string) {
    const normalizedAddress = address.toLowerCase()
    const mappedIpv4 = normalizedAddress.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mappedIpv4) {
      return this.isUnsafeIpv4Address(mappedIpv4[1])
    }

    return (
      normalizedAddress === '::' ||
      normalizedAddress === '::1' ||
      normalizedAddress.startsWith('fe8') ||
      normalizedAddress.startsWith('fe9') ||
      normalizedAddress.startsWith('fea') ||
      normalizedAddress.startsWith('feb') ||
      normalizedAddress.startsWith('fc') ||
      normalizedAddress.startsWith('fd') ||
      normalizedAddress.startsWith('ff') ||
      normalizedAddress.startsWith('2001:db8')
    )
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
