import process from 'node:process'
import { registerAs } from '@nestjs/config'
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

export const AuthConfig = registerAs('auth', () => ({
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: 4 * TIME_CONSTANTS.HOUR,
  // 刷新令牌过期时间：默认 7 天
  refreshExpiresIn: 7 * TIME_CONSTANTS.DAY,
  // 令牌类型标识
  aud: 'admin',
  // 需要 JWT 认证保护的管理端路径前缀
  guardPathPrefixes: ['/admin', '/api/admin'],
  // Passport策略名称
  strategyKey: 'admin-auth',
}))
