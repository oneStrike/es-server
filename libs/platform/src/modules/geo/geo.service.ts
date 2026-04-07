import type { ClientRequestContext } from '@libs/platform/utils/request-parse.types'
import type { OnModuleDestroy } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import type { Searcher } from 'ip2region.js'
import type { GeoLookupResult } from './geo.types'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { extractClientRequestContext, extractIpAddress, extractRequestContext } from '@libs/platform/utils/requestParse'
import { Injectable } from '@nestjs/common'
import * as ip2region from 'ip2region.js'
import { mergeGeoClientContext, parseIpRegionText } from './geo.helpers'

const DEFAULT_IP2REGION_DB_PATH = resolve(
  process.cwd(),
  'db/resources/ip2region/ip2region_v4.xdb',
)
const { IPv4, loadContentFromFile, newWithBuffer } = ip2region
const ip2regionWithVerify = ip2region as typeof ip2region & {
  verifyFromFile: (dbPath: string) => void
}

function normalizeLookupIp(ip?: string) {
  const normalized = ip?.trim()
  if (!normalized || normalized.toLowerCase() === 'unknown') {
    return undefined
  }

  return normalized.startsWith('::ffff:')
    ? normalized.slice('::ffff:'.length)
    : normalized
}

@Injectable()
export class GeoService implements OnModuleDestroy {
  private searcher?: Searcher
  private initializePromise?: Promise<void>
  private unavailable = false

  private resolveDatabasePath() {
    const configuredPath = process.env.IP2REGION_XDB_PATH?.trim()
    return configuredPath || DEFAULT_IP2REGION_DB_PATH
  }

  private async ensureSearcher() {
    if (this.searcher || this.unavailable) {
      return
    }

    if (!this.initializePromise) {
      this.initializePromise = Promise.resolve().then(() => {
        const dbPath = this.resolveDatabasePath()
        if (!dbPath || !existsSync(dbPath)) {
          this.unavailable = true
          return
        }

        ip2regionWithVerify.verifyFromFile(dbPath)
        const dbContent = loadContentFromFile(dbPath)
        this.searcher = newWithBuffer(IPv4, dbContent)
      }).catch(() => {
        this.unavailable = true
        this.searcher = undefined
      })
    }

    await this.initializePromise
  }

  /**
   * 按 IP 解析属地。
   * xdb 缺失、查询失败或结果为空时均降级为空字段，避免把附加信息查询放大为主链路错误。
   */
  async resolveByIp(ip?: string): Promise<GeoLookupResult> {
    const normalizedIp = normalizeLookupIp(ip)
    const emptyGeo = parseIpRegionText()

    if (!normalizedIp) {
      return emptyGeo
    }

    await this.ensureSearcher()
    if (!this.searcher) {
      return emptyGeo
    }

    try {
      return parseIpRegionText(this.searcher.search(normalizedIp))
    } catch {
      return emptyGeo
    }
  }

  /**
   * 为已有客户端上下文补齐属地字段。
   */
  async enrichClientRequestContext(
    context: ClientRequestContext,
  ): Promise<ClientRequestContext> {
    return mergeGeoClientContext(context, await this.resolveByIp(context.ip))
  }

  /**
   * 从 FastifyRequest 构建包含属地的客户端上下文。
   */
  async buildClientRequestContext(
    req: FastifyRequest,
  ): Promise<ClientRequestContext> {
    return this.enrichClientRequestContext(extractClientRequestContext(req))
  }

  /**
   * 从 FastifyRequest 构建包含属地的完整请求上下文。
   */
  async buildRequestContext(req: FastifyRequest) {
    return {
      ...extractRequestContext(req),
      ...(await this.resolveByIp(extractIpAddress(req))),
    }
  }

  onModuleDestroy() {
    this.searcher?.close()
  }
}
