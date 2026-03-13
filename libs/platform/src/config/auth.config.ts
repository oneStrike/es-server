import type { AuthConfigInterface } from '../types'
import process from 'node:process'
import { registerAs } from '@nestjs/config'

// 获取环境变量
const {
  JWT_EXPIRATION_IN = '4h',
  JWT_REFRESH_EXPIRATION_IN = '7d',
  JWT_JWT_ISSUER = 'es',
  JWT_JWT_AUD = 'es',
  JWT_STRATEGY_KEY = 'jwt',
} = process.env

export const AuthConfig = {
  expiresIn: JWT_EXPIRATION_IN as AuthConfigInterface['expiresIn'],
  refreshExpiresIn:
    JWT_REFRESH_EXPIRATION_IN as AuthConfigInterface['refreshExpiresIn'],
  aud: JWT_JWT_AUD,
  iss: JWT_JWT_ISSUER,
  strategyKey: JWT_STRATEGY_KEY,
}

// 创建认证配置注册器
export const AuthConfigRegister = registerAs(
  'auth',
  (): AuthConfigInterface => AuthConfig,
)
