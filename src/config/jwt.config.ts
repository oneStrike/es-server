import process from 'node:process'
import dotenv from 'dotenv'

// 加载环境变量配置文件
// 根据 NODE_ENV 环境变量选择对应的配置文件（.env.development 或 .env.production）
dotenv.config({
  path: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env',
})

/**
 * 时间常量定义（秒）
 */
const TIME_CONSTANTS = {
  HOUR: 60 * 60,
  DAY: 24 * 60 * 60,
} as const

/**
 * 获取指定类型的 JWT 基础配置
 */
function getJwtConfig(type: 'ADMIN' | 'CLIENT') {
  const env = process.env

  // 从环境变量中读取密钥配置
  const secret = env[`${type}_JWT_SECRET`]
  const refreshSecret = env[`${type}_JWT_REFRESH_SECRET`]

  // 验证必需的环境变量
  if (!secret || !refreshSecret) {
    throw new Error(
      `缺少必需的 JWT 配置: ${type}_JWT_SECRET 或 ${type}_JWT_REFRESH_SECRET`,
    )
  }

  return {
    secret,
    refreshSecret,
  }
}

/**
 * 管理端 JWT 配置
 */
export const ADMIN_AUTH_CONFIG = {
  ...getJwtConfig('ADMIN'),
  // 访问令牌过期时间：默认 4 小时
  expiresIn: 4 * TIME_CONSTANTS.HOUR,
  // 刷新令牌过期时间：默认 7 天
  refreshExpiresIn: 7 * TIME_CONSTANTS.DAY,
  // 令牌类型标识
  aud: 'admin',
  // 需要 JWT 认证保护的管理端路径前缀
  guardPathPrefixes: ['/admin', '/api/admin'],
  // Passport策略名称
  strategyKey: 'admin-auth',
  // 黑名单缓存 TTL 配置（用于令牌注销后的缓存时间）
  blackListTtl: {
    // 访问令牌黑名单缓存时间需要与令牌过期时间一致
    accessToken: 4 * TIME_CONSTANTS.HOUR,
    // 刷新令牌黑名单缓存时间需要与令牌过期时间一致
    refreshToken: 7 * TIME_CONSTANTS.DAY,
  },
} as const

/**
 * 客户端 JWT 配置
 */
export const CLIENT_AUTH_CONFIG = {
  ...getJwtConfig('CLIENT'),
  // 访问令牌过期时间：默认 4 小时
  expiresIn: 4 * TIME_CONSTANTS.HOUR,
  // 刷新令牌过期时间：默认 7 天
  refreshExpiresIn: 7 * TIME_CONSTANTS.DAY,
  // 令牌类型标识
  aud: 'client',
  // 需要 JWT 认证保护的客户端路径前缀
  guardPathPrefixes: ['/client', '/api/client'],
  // Passport策略名称
  strategyKey: 'client-auth',
  // 黑名单缓存 TTL 配置（用于令牌注销后的缓存时间）
  blackListTtl: {
    // 访问令牌黑名单缓存时间需要与令牌过期时间一致
    accessToken: 4 * TIME_CONSTANTS.HOUR,
    // 刷新令牌黑名单缓存时间需要与令牌过期时间一致
    refreshToken: 7 * TIME_CONSTANTS.DAY,
  },
} as const
