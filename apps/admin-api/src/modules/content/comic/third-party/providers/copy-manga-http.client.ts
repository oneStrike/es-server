import type {
  CopyMangaNetworkResponse,
  CopyMangaTransportError,
} from './copy-manga.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { ThirdPartyResourceThrottleService } from '../services/third-party-resource-throttle.service'

const COPY_MANGA_DEFAULT_API_HOST = 'api.2024manga.com'
const COPY_MANGA_PLATFORM = 3
const COPY_MANGA_REQUEST_ATTEMPTS = 3
const COPY_MANGA_VERSION = '2024.4.28'
const COPY_MANGA_REQUEST_TIMEOUT_MS = 300000

@Injectable()
export class CopyMangaHttpClient {
  private apiHostCache: { expiresAt: number; hosts: string[] } | null = null

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
        return await this.fetchJson<TPayload>(`https://${host}${path}`, {
          ...params,
          platform: COPY_MANGA_PLATFORM,
        })
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
        const data = await this.fetchJson<CopyMangaNetworkResponse>(
          `https://${COPY_MANGA_DEFAULT_API_HOST}/api/v3/system/network2`,
          {
            platform: COPY_MANGA_PLATFORM,
          },
        )
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

    return new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `CopyManga API 请求失败：${reason} (${path})`,
    )
  }

  // 从传输错误中提取 HTTP 状态码。
  private readHttpStatus(error: unknown) {
    if (!this.isCopyMangaTransportError(error)) {
      return undefined
    }

    const status = error.response?.status
    return typeof status === 'number' ? status : undefined
  }

  // 发送 CopyManga JSON 请求，统一保留请求头、超时和 HTTP 失败形状。
  private async fetchJson<TPayload>(
    url: string,
    params: Record<string, unknown>,
  ): Promise<TPayload> {
    const response = await fetch(this.withParams(url, params), {
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(COPY_MANGA_REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw Object.assign(new Error(`HTTP ${response.status}`), {
        response: {
          status: response.status,
        },
      } satisfies Pick<CopyMangaTransportError, 'response'>)
    }
    return (await response.json()) as TPayload
  }

  // 构建 CopyManga 固定请求头，避免对象字面量混合 quoted/unquoted key。
  private buildHeaders() {
    const headers = new Headers()
    headers.set('accept', 'application/json')
    headers.set('authorization', 'Token ')
    headers.set('platform', String(COPY_MANGA_PLATFORM))
    headers.set('version', COPY_MANGA_VERSION)
    headers.set('webp', '1')
    headers.set('x-requested-with', 'com.manga2020.app')
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
}
