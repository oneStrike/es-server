import type { CopyMangaNetworkResponse } from './copy-manga.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'

const COPY_MANGA_DEFAULT_API_HOST = 'api.2024manga.com'
const COPY_MANGA_PLATFORM = 3
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
    for (const host of apiHosts) {
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

    throw lastError
  }

  // 调用 CopyManga host discovery，并对所有异常/畸形结果执行 fail closed。
  private async refreshApiHosts() {
    const response = await this.httpClient.get<CopyMangaNetworkResponse>(
      `https://${COPY_MANGA_DEFAULT_API_HOST}/api/v3/system/network2`,
      {
        params: {
          platform: COPY_MANGA_PLATFORM,
        },
      },
    )
    if (response.data.code !== 200) {
      throw this.hostDiscoveryError(
        response.data.message || 'CopyManga host discovery failed',
      )
    }

    const discoveredHosts = this.extractApiHosts(response.data.results?.api)
    if (discoveredHosts.length === 0) {
      throw this.hostDiscoveryError(
        'CopyManga host discovery returned no hosts',
      )
    }

    return discoveredHosts
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
}
