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
