import type { ClientRequestContext } from '@libs/platform/utils/request-parse.types'
import type { GeoLookupResult, GeoSnapshot } from './geo.types'
import { GEO_SOURCE } from './geo.types'

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

function normalizeGeoSegment(value?: string) {
  const normalized = value?.trim()
  if (!normalized) {
    return undefined
  }

  return EMPTY_GEO_TOKENS.has(normalized) ? undefined : normalized
}

/**
 * 解析 ip2region 返回的 region 文本。
 * `ip2region_v4.xdb` 当前返回 `国家|省份|城市|运营商|国家代码`，末位国家代码不落库。
 */
export function parseIpRegionText(regionText?: string): GeoLookupResult {
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
export function mergeGeoClientContext(
  context: ClientRequestContext,
  geo: GeoSnapshot,
): ClientRequestContext {
  return {
    ...context,
    ...geo,
  }
}
