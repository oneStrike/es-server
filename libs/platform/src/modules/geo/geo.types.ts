/**
 * 属地来源常量。
 * 当前仓库统一使用 ip2region 开源版离线库，不派生第二套来源值。
 */
export const GEO_SOURCE = 'ip2region' as const

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
 * 当前进程正在使用的属地库来源。
 */
export type GeoRuntimeSource =
  | 'managed-active'
  | 'configured-path'
  | 'default-path'
  | 'unavailable'

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
  filePath?: string
  fileName?: string
  fileSize?: number
  activatedAt?: Date
  storageDir?: string
}

/**
 * 热切换时写入当前运行状态所需的最小元信息。
 */
export interface GeoReloadFileInfo {
  source?: Exclude<GeoRuntimeSource, 'unavailable'>
  fileName?: string
  fileSize?: number
  activatedAt?: Date
}
