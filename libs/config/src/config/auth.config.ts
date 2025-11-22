import type { IAuthConfig } from '@libs/auth'
import process from 'node:process'
import { registerAs } from '@nestjs/config'

const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  EXPIRATION_IN,
  REFRESH_EXPIRATION_IN,
  JWT_ISSUER,
  JWT_AUD,
  JWT_STRATEGY_KEY,
} = process.env

const defaultConfig = {
  expiresIn: '4h',
  refreshExpiresIn: '7d',
  aud: 'es',
  iss: 'es',
  strategyKey: 'es',
}

export const AuthConfig: IAuthConfig = {
  secret: JWT_SECRET!,
  refreshSecret: JWT_REFRESH_SECRET!,
  expiresIn: (EXPIRATION_IN as IAuthConfig['expiresIn']) || '4h',
  // 刷新令牌过期时间：默认 7 天
  refreshExpiresIn:
    (REFRESH_EXPIRATION_IN as IAuthConfig['refreshExpiresIn']) ||
    defaultConfig.refreshExpiresIn,
  // 令牌类型标识
  aud: JWT_AUD || defaultConfig.aud,
  // 发行者标识
  iss: JWT_ISSUER || defaultConfig.iss,
  // Passport策略名称
  strategyKey: JWT_STRATEGY_KEY || defaultConfig.strategyKey,
}

export const AuthConfigRegister = registerAs('auth', () => AuthConfig)
