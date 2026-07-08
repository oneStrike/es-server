import { isIP } from 'node:net'
import process from 'node:process'

export type FastifyTrustProxyConfig = false | number | string | string[]

const CIDR_SEPARATOR = '/'
const IPV4_MAX_PREFIX = 32
const IPV6_MAX_PREFIX = 128

// 将空白环境变量统一视为未配置，避免空字符串进入 Fastify trustProxy。
function normalizeEnvValue(value?: string) {
  const normalized = value?.trim()
  return normalized || undefined
}

// 解析正整数代理跳数；缺失、0 或非法值都保持 fail-closed。
function parseTrustedProxyHops(value?: string) {
  const normalized = normalizeEnvValue(value)
  if (!normalized || !/^\d+$/.test(normalized)) {
    return false
  }

  const hopCount = Number(normalized)
  return Number.isSafeInteger(hopCount) && hopCount > 0 ? hopCount : false
}

// 校验 CIDR 写法，确保 IP 版本和前缀长度匹配。
function isValidCidr(value: string) {
  const [ip, prefix, extra] = value.split(CIDR_SEPARATOR)
  if (!ip || !prefix || extra !== undefined) {
    return false
  }

  const ipVersion = isIP(ip)
  if (!ipVersion || !/^\d+$/.test(prefix)) {
    return false
  }

  const prefixLength = Number(prefix)
  const maxPrefixLength = ipVersion === 4 ? IPV4_MAX_PREFIX : IPV6_MAX_PREFIX

  return (
    Number.isSafeInteger(prefixLength) &&
    prefixLength >= 0 &&
    prefixLength <= maxPrefixLength
  )
}

// 判断单个代理 allowlist 条目是否为合法 IP 或 CIDR。
export function isValidTrustedProxyEntry(value: string) {
  const normalized = value.trim()
  return isIP(normalized) !== 0 || isValidCidr(normalized)
}

// 解析逗号分隔的代理 IP/CIDR allowlist，非法条目直接失败以阻止错误启动。
export function parseTrustedProxyIps(value?: string) {
  const normalized = normalizeEnvValue(value)
  if (!normalized) {
    return undefined
  }

  const entries = normalized
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (entries.length === 0) {
    return undefined
  }

  const invalidEntry = entries.find((entry) => !isValidTrustedProxyEntry(entry))
  if (invalidEntry) {
    throw new Error(`Invalid TRUSTED_PROXY_IPS entry: ${invalidEntry}`)
  }

  return entries.length === 1 ? entries[0] : entries
}

// 根据环境变量生成 Fastify trustProxy 配置，默认关闭并禁止两种信任模式混用。
export function resolveFastifyTrustProxy(
  env: NodeJS.ProcessEnv = process.env,
): FastifyTrustProxyConfig {
  const trustedProxyIps = parseTrustedProxyIps(env.TRUSTED_PROXY_IPS)
  const trustedProxyHops = parseTrustedProxyHops(env.TRUST_PROXY_HOPS)

  if (trustedProxyIps && trustedProxyHops !== false) {
    throw new Error(
      'TRUSTED_PROXY_IPS and positive TRUST_PROXY_HOPS cannot be used together',
    )
  }

  return trustedProxyIps ?? trustedProxyHops
}
