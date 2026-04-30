import type { ClientRequestContext } from '@libs/platform/utils'
import type { OnModuleDestroy } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import type { Searcher } from 'ip2region.js'
import type {
  GeoLookupResult,
  GeoManagedActiveMetadata,
  GeoReloadFileInfo,
  GeoRuntimeStatus,
  GeoSnapshot,
} from './geo.type'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import {
  extractClientRequestContext,
  extractIpAddress,
  extractRequestContext,
} from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import * as ip2region from 'ip2region.js'
import { GEO_RUNTIME_SOURCE, GEO_SOURCE } from './geo.type'

const DEFAULT_IP2REGION_DB_PATH = resolve(
  process.cwd(),
  'db/resources/ip2region/ip2region_v4.xdb',
)
const DEFAULT_IP2REGION_MANAGED_STORAGE_DIR = './uploads/ip2region'
const { IPv4, loadContentFromFile, newWithBuffer } = ip2region
const ip2regionWithVerify = ip2region as typeof ip2region & {
  verifyFromFile: (dbPath: string) => void
}
const EMPTY_GEO_TOKENS = new Set([
  '',
  '0',
  'null',
  'undefined',
  '内网IP',
  'unknown',
  '未知',
  'local',
  'localhost',
])

function normalizeLookupIp(ip?: string) {
  const normalized = ip?.trim()
  if (!normalized || normalized.toLowerCase() === 'unknown') {
    return undefined
  }

  return normalized.startsWith('::ffff:')
    ? normalized.slice('::ffff:'.length)
    : normalized
}

function normalizeGeoSegment(value?: string) {
  const normalized = value?.trim()
  if (!normalized) {
    return undefined
  }

  return EMPTY_GEO_TOKENS.has(normalized) ? undefined : normalized
}

/**
 * 解析 ip2region 托管目录。
 * 未配置环境变量时回退到管理端上传默认目录，确保热切换后的 active 库在进程重启后仍可恢复。
 */
export function resolveGeoManagedStorageDir(
  configuredDir = process.env.IP2REGION_DATA_DIR?.trim(),
) {
  return resolve(
    process.cwd(),
    configuredDir || DEFAULT_IP2REGION_MANAGED_STORAGE_DIR,
  )
}

/**
 * 解析 ip2region 返回的 region 文本。
 * `ip2region_v4.xdb` 当前返回 `国家|省份|城市|运营商|国家代码`，末位国家代码不落库。
 */
function parseIpRegionText(regionText?: string) {
  const [country, province, city, isp] = (regionText ?? '')
    .split('|')
    .map((segment) => normalizeGeoSegment(segment))

  return {
    geoCountry: country,
    geoProvince: province,
    geoCity: city,
    geoIsp: isp,
    geoSource: GEO_SOURCE,
  }
}

/**
 * 将属地快照合并进客户端上下文。
 * 保持原有 `ip/userAgent/deviceInfo` 结构不变，只补充统一属地字段。
 */
function mergeGeoClientContext(
  context: ClientRequestContext,
  geo: GeoSnapshot,
) {
  return {
    ...context,
    ...geo,
  }
}

@Injectable()
export class GeoService implements OnModuleDestroy {
  private searcher?: Searcher
  private initializePromise?: Promise<void>
  private unavailable = false
  private activeStatus?: GeoRuntimeStatus

  /**
   * 获取 ip2region 托管目录。
   * 未配置时回退到管理端默认上传目录，保持运行时与后台管理目录解析一致。
   */
  private getManagedStorageDir() {
    return resolveGeoManagedStorageDir()
  }

  /**
   * 读取 active 目录元信息。
   * 元信息损坏时降级为 undefined，避免状态文件问题拖垮主链路。
   */
  private readManagedActiveMetadata() {
    const storageDir = this.getManagedStorageDir()
    if (!storageDir) {
      return undefined
    }

    const metadataPath = resolve(storageDir, 'active', 'metadata.json')
    if (!existsSync(metadataPath)) {
      return undefined
    }

    try {
      const metadata = JSON.parse(
        readFileSync(metadataPath, 'utf8'),
      ) as GeoManagedActiveMetadata

      if (!metadata.activeFileName) {
        return undefined
      }

      return {
        storageDir,
        metadata,
      }
    } catch {
      return undefined
    }
  }

  /**
   * 解析 active 目录中的当前生效文件。
   * 优先读取 metadata.json，缺失时退回到 active 目录中的最新 `.xdb` 文件。
   */
  private resolveManagedActiveStatus() {
    const metadataResult = this.readManagedActiveMetadata()
    if (metadataResult) {
      const { storageDir, metadata } = metadataResult
      const filePath = resolve(storageDir, 'active', metadata.activeFileName)

      if (existsSync(filePath)) {
        return {
          ready: true,
          source: GEO_RUNTIME_SOURCE.MANAGED_ACTIVE,
          filePath,
          fileName: metadata.activeFileName,
          fileSize: metadata.fileSize ?? statSync(filePath).size,
          activatedAt: metadata.activatedAt
            ? new Date(metadata.activatedAt)
            : statSync(filePath).mtime,
          storageDir,
        }
      }
    }

    const storageDir = this.getManagedStorageDir()
    if (!storageDir) {
      return undefined
    }

    const activeDir = resolve(storageDir, 'active')
    if (!existsSync(activeDir)) {
      return undefined
    }

    const activeFileName = readdirSync(activeDir)
      .filter((fileName) => fileName.toLowerCase().endsWith('.xdb'))
      .sort()
      .at(-1)

    if (!activeFileName) {
      return undefined
    }

    const filePath = resolve(activeDir, activeFileName)
    const fileStat = statSync(filePath)

    return {
      ready: true,
      source: GEO_RUNTIME_SOURCE.MANAGED_ACTIVE,
      filePath,
      fileName: activeFileName,
      fileSize: fileStat.size,
      activatedAt: fileStat.mtime,
      storageDir,
    }
  }

  /**
   * 解析当前应加载的属地库状态。
   * 按优先级依次尝试托管 active 文件、显式配置路径和仓库内默认库。
   */
  private resolvePreferredStatus() {
    const managedStatus = this.resolveManagedActiveStatus()
    if (managedStatus) {
      return managedStatus
    }

    const storageDir = this.getManagedStorageDir()
    const configuredPath = process.env.IP2REGION_XDB_PATH?.trim()
    if (configuredPath && existsSync(configuredPath)) {
      const fileStat = statSync(configuredPath)
      return {
        ready: true,
        source: GEO_RUNTIME_SOURCE.CONFIGURED_PATH,
        filePath: configuredPath,
        fileName: basename(configuredPath),
        fileSize: fileStat.size,
        activatedAt: fileStat.mtime,
        storageDir,
      }
    }

    if (existsSync(DEFAULT_IP2REGION_DB_PATH)) {
      const fileStat = statSync(DEFAULT_IP2REGION_DB_PATH)
      return {
        ready: true,
        source: GEO_RUNTIME_SOURCE.DEFAULT_PATH,
        filePath: DEFAULT_IP2REGION_DB_PATH,
        fileName: basename(DEFAULT_IP2REGION_DB_PATH),
        fileSize: fileStat.size,
        activatedAt: fileStat.mtime,
        storageDir,
      }
    }

    return {
      ready: false,
      source: GEO_RUNTIME_SOURCE.UNAVAILABLE,
      storageDir,
    }
  }

  /**
   * 根据文件路径构建查询器。
   * 查询器创建失败时抛出原始异常，由上层决定是否回退。
   */
  private createSearcherFromFile(dbPath: string) {
    ip2regionWithVerify.verifyFromFile(dbPath)
    const dbContent = loadContentFromFile(dbPath)
    return newWithBuffer(IPv4, dbContent)
  }

  /**
   * 基于给定文件路径生成运行状态。
   * 热切换场景优先使用调用方已知的元信息，避免额外依赖磁盘 stat。
   */
  private buildStatusFromFile(filePath: string, info: GeoReloadFileInfo = {}) {
    const fileStat = existsSync(filePath) ? statSync(filePath) : undefined

    return {
      ready: true,
      source: info.source ?? GEO_RUNTIME_SOURCE.CONFIGURED_PATH,
      filePath,
      fileName: info.fileName ?? basename(filePath),
      fileSize: info.fileSize ?? fileStat?.size,
      activatedAt: info.activatedAt ?? fileStat?.mtime,
      storageDir: this.getManagedStorageDir(),
    }
  }

  /**
   * 确保当前进程已加载查询器。
   * 首次加载按优先级解析当前生效库；加载失败时保留降级为空属地的语义。
   */
  private async ensureSearcher() {
    if (this.searcher || this.unavailable) {
      return
    }

    if (!this.initializePromise) {
      this.initializePromise = Promise.resolve()
        .then(() => {
          const preferredStatus = this.resolvePreferredStatus()
          const dbPath = preferredStatus.filePath
          if (!dbPath || !existsSync(dbPath)) {
            this.unavailable = true
            this.activeStatus = preferredStatus
            return
          }

          this.searcher = this.createSearcherFromFile(dbPath)
          this.unavailable = false
          this.activeStatus = preferredStatus
        })
        .catch(() => {
          this.unavailable = true
          this.searcher = undefined
          this.activeStatus = {
            ...this.resolvePreferredStatus(),
            ready: false,
          }
        })
    }

    await this.initializePromise
  }

  /**
   * 获取当前进程的属地库运行状态。
   * 未触发查询前也可返回当前应加载的候选文件与来源，便于后台管理页排障。
   */
  async getRuntimeStatus(): Promise<GeoRuntimeStatus> {
    if (this.activeStatus) {
      return {
        ...this.activeStatus,
        storageDir: this.getManagedStorageDir(),
      }
    }

    return this.resolvePreferredStatus()
  }

  /**
   * 使用指定 `.xdb` 文件热切换当前进程查询器。
   * 仅在新查询器创建成功后才替换旧实例，确保失败时仍保留在线查询能力。
   */
  async reloadFromFile(
    filePath: string,
    info: GeoReloadFileInfo = {},
  ): Promise<GeoRuntimeStatus> {
    const nextSearcher = this.createSearcherFromFile(filePath)
    const previousSearcher = this.searcher
    const nextStatus = this.buildStatusFromFile(filePath, info)

    this.searcher = nextSearcher
    this.initializePromise = undefined
    this.unavailable = false
    this.activeStatus = nextStatus

    previousSearcher?.close()

    return nextStatus
  }

  /**
   * 校验指定 `.xdb` 文件是否可被当前进程加载。
   * 仅用于预检上传文件结构，不会修改当前在线查询器。
   */
  async validateFile(filePath: string): Promise<void> {
    const searcher = this.createSearcherFromFile(filePath)
    searcher.close()
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
      // ip2region.js 运行时返回 Promise<string>，但内置类型仍声明为 string，
      // 这里统一包一层 Promise.resolve，兼容实际运行时与错误类型定义。
      const regionText = await Promise.resolve(
        this.searcher.search(normalizedIp),
      )
      return parseIpRegionText(regionText)
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
