import type { CopyMangaNetworkResponse } from './copy-manga.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'

const COPY_MANGA_DEFAULT_API_HOST = 'api.2024manga.com'
const COPY_MANGA_PLATFORM = 3
const COPY_MANGA_REQUEST_ATTEMPTS = 3
const COPY_MANGA_VERSION = '2024.4.28'

@Injectable()
export class CopyMangaHttpClient {
  private readonly httpClient: AxiosInstance

  // 初始化 CopyManga 专用 HTTP client，保留平台请求头约束。
  constructor() {
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        "accept": 'application/json',
        "authorization": 'Token ',
        "platform": COPY_MANGA_PLATFORM,
        "version": COPY_MANGA_VERSION,
        "webp": 1,
        'x-requested-with': 'com.manga2020.app',
      },
    })
  }

  // 每次业务请求前强制刷新 host，发现失败时不继续请求内容 API。
  async getJson<TPayload = unknown>(
    path: string,
    params: Record<string, unknown> = {},
  ): Promise<TPayload> {
    const apiHosts = await this.refreshApiHosts()

    let lastError: unknown
    for (let attempt = 0; attempt < COPY_MANGA_REQUEST_ATTEMPTS; attempt++) {
      const host = apiHosts[attempt % apiHosts.length]
      try {
        const response = await this.httpClient.get(`https://${host}${path}`, {
          params: {
            ...params,
            platform: COPY_MANGA_PLATFORM,
          },
        })
        return response.data as TPayload
      } catch (error) {
        lastError = error
      }
    }

    throw this.apiRequestError(path, lastError)
  }

  // 调用 CopyManga host discovery，并对所有异常/畸形结果执行 fail closed。
  private async refreshApiHosts() {
    let lastError: unknown
    for (let attempt = 0; attempt < COPY_MANGA_REQUEST_ATTEMPTS; attempt++) {
      try {
        const response = await this.httpClient.get<CopyMangaNetworkResponse>(
          `https://${COPY_MANGA_DEFAULT_API_HOST}/api/v3/system/network2`,
          {
            params: {
              platform: COPY_MANGA_PLATFORM,
            },
          },
        )
        if (response.data.code !== 200) {
          lastError = new Error(
            response.data.message || 'CopyManga host discovery failed',
          )
          continue
        }

        const discoveredHosts = this.extractApiHosts(response.data.results?.api)
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

    return api
      .flat()
      .map((host) => (typeof host === 'string' ? host.trim() : ''))
      .filter((host) => host.length > 0)
      .filter((host, index, hosts) => hosts.indexOf(host) === index)
  }

  // 统一 discovery 的可预期失败，避免静默回退到默认或旧 host。
  private hostDiscoveryError(message: string) {
    return new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message,
    )
  }

  // 将内容 API 的网络/HTTP 失败归类为业务错误，避免 AxiosError 泄漏成 500。
  private apiRequestError(path: string, error: unknown) {
    if (error instanceof BusinessException) {
      return error
    }

    const status = this.readHttpStatus(error)
    let reason = 'unknown upstream error'
    if (status !== undefined) {
      reason = `HTTP ${status}`
    } else if (error instanceof Error) {
      reason = error.message
    }

    return new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `CopyManga API 请求失败：${reason} (${path})`,
    )
  }

  private readHttpStatus(error: unknown) {
    if (!error || typeof error !== 'object' || !('response' in error)) {
      return undefined
    }

    const response = (error as { response?: { status?: unknown } }).response
    return typeof response?.status === 'number' ? response.status : undefined
  }
}
