/**
 * 认证相关常量配置
 */

/**
 * JWT 令牌受众标识
 */
export const JWT_AUDIENCE = {
  ADMIN: 'admin-api',
  CLIENT: 'client-api',
} as const

/**
 * JWT 黑名单默认过期时间配置（秒）
 */
export const BLACKLIST_DEFAULT_TTL = {
  // 访问令牌默认保留时间：与令牌过期时间一致
  ACCESS_TOKEN: 4 * 60 * 60, // 4小时
  // 刷新令牌默认保留时间：与令牌过期时间一致
  REFRESH_TOKEN: 7 * 24 * 60 * 60, // 7天
} as const

/**
 * 守卫路径前缀配置
 */
export const GUARD_PATH_PREFIXES = {
  ADMIN: ['/admin', '/api/admin'],
  CLIENT: ['/client', '/api/client', '/app', '/api/app'],
} as const

/**
 * 令牌类型
 */
export const TOKEN_TYPE = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const
