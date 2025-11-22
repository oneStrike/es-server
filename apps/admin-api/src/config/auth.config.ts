import type { IAuthConfig } from '@libs/auth'
import process from 'node:process'
import { registerAs } from '@nestjs/config'

const { JWT_SECRET, JWT_REFRESH_SECRET, EXPIRATION_IN, REFRESH_EXPIRATION_IN } =
  process.env

/**
 * 时间常量定义（秒）
 */
const TIME_CONSTANTS = {
  HOUR: 60 * 60,
  DAY: 24 * 60 * 60,
} as const

export const AuthConfig: IAuthConfig = {
  secret: JWT_SECRET!,
  refreshSecret: JWT_REFRESH_SECRET!,
  expiresIn: Number(EXPIRATION_IN) || 4 * TIME_CONSTANTS.HOUR,
  // 刷新令牌过期时间：默认 7 天
  refreshExpiresIn: Number(REFRESH_EXPIRATION_IN) || 7 * TIME_CONSTANTS.DAY,
  // 令牌类型标识
  aud: 'admin',
  // 发行者标识（可通过环境变量覆盖）
  iss: process.env.JWT_ISSUER || 'es-admin',
  // Passport策略名称
  strategyKey: 'admin-auth',
}

export const AuthConfigRegister = registerAs('auth', () => AuthConfig)
