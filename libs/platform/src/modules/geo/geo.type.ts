/**
 * 属地来源常量。
 * 当前仓库统一使用 ip2region 开源版离线库，不派生第二套来源值。
 */
export const GEO_SOURCE = 'ip2region' as const

/** 稳定领域类型 `GeoSource`。仅供内部领域/服务链路复用，避免重复定义。 */
export type GeoSource = typeof GEO_SOURCE

/**
 * 当前进程正在使用的属地库来源常量。
 * 统一给运行状态、DTO 文档和管理端展示复用，避免字面量分叉。
 */
export const GEO_RUNTIME_SOURCE = {
  /** 使用管理端上传并已激活的属地库。 */
  MANAGED_ACTIVE: 'managed-active',
  /** 使用显式配置路径中的属地库。 */
  CONFIGURED_PATH: 'configured-path',
  /** 使用默认路径中的属地库。 */
  DEFAULT_PATH: 'default-path',
  /** 当前进程没有可用属地库。 */
  UNAVAILABLE: 'unavailable',
} as const

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
  (typeof GEO_RUNTIME_SOURCE)[keyof typeof GEO_RUNTIME_SOURCE]

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
  source?: Exclude<GeoRuntimeSource, typeof GEO_RUNTIME_SOURCE.UNAVAILABLE>
  fileName?: string
  fileSize?: number
  activatedAt?: Date
}
