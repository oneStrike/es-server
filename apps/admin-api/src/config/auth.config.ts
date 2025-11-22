import type { IAuthConfig } from '@libs/auth'
import process from 'node:process'
import { registerAs } from '@nestjs/config'

const { JWT_SECRET, JWT_REFRESH_SECRET, EXPIRATION_IN, REFRESH_EXPIRATION_IN } =
  process.env

export const AuthConfig: IAuthConfig = {
  secret: JWT_SECRET!,
  refreshSecret: JWT_REFRESH_SECRET!,
  expiresIn: (EXPIRATION_IN as IAuthConfig['expiresIn']) || '4h',
  // 刷新令牌过期时间：默认 7 天
  refreshExpiresIn:
    (REFRESH_EXPIRATION_IN as IAuthConfig['refreshExpiresIn']) || '7d',
  // 令牌类型标识
  aud: 'admin',
  // 发行者标识（可通过环境变量覆盖）
  iss: process.env.JWT_ISSUER || 'es-admin',
  // Passport策略名称
  strategyKey: 'admin-auth',
}

export const AuthConfigRegister = registerAs('auth', () => AuthConfig)
