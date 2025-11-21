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

export const AuthConfig = {
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: 4 * TIME_CONSTANTS.HOUR,
  // 刷新令牌过期时间：默认 7 天
  refreshExpiresIn: 7 * TIME_CONSTANTS.DAY,
  // 令牌类型标识
  aud: 'admin',
  // 发行者标识（可通过环境变量覆盖）
  iss: process.env.JWT_ISSUER || 'es-admin',
  // Passport策略名称
  strategyKey: 'admin-auth',
}

export const AuthConfigRegister = registerAs('auth', () => AuthConfig)
