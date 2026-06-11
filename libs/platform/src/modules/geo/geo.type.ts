import type { GeoRuntimeSource } from './geo.constant'
import { GEO_RUNTIME_SOURCE } from './geo.constant'

/**
 * 属地来源常量。
 * 当前仓库统一使用 ip2region 开源版离线库，不派生第二套来源值。
 */
export const GEO_SOURCE = 'ip2region' as const

/** 稳定领域类型 `GeoSource`。仅供内部领域/服务链路复用，避免重复定义。 */
export type GeoSource = typeof GEO_SOURCE

/**
 * 统一属地快照。
 * 所有写入链路与对外 DTO 统一复用这一组固定字段。
 */
export interface GeoSnapshot {
  geoCountry?: string | null
  geoProvince?: string | null
  geoCity?: string | null
  geoIsp?: string | null
  geoSource?: string | null
}

/**
 * 属地查询结果。
 * 与持久化快照保持同构，便于直接透传到客户端上下文与写库链路。
 */
export type GeoLookupResult = GeoSnapshot

/**
 * active 目录中的当前生效库元信息。
 */
export interface GeoManagedActiveMetadata {
  activeFileName: string
  originalFileName?: string
  activatedAt?: string
  fileSize?: number
}

/**
 * 当前进程的属地库运行状态。
 */
export interface GeoRuntimeStatus {
  ready: boolean
  source: GeoRuntimeSource
  filePath: string | null
  fileName: string | null
  fileSize: number | null
  activatedAt: Date | null
  storageDir: string
}

/**
 * 热切换时写入当前运行状态所需的最小元信息。
 */
export interface GeoReloadFileInfo {
  source?: Exclude<GeoRuntimeSource, typeof GEO_RUNTIME_SOURCE.UNAVAILABLE>
  fileName?: string
  fileSize?: number
  activatedAt?: Date
}
