import type { IAuthConfig } from '@libs/auth'
import process from 'node:process'
import { registerAs } from '@nestjs/config'

// 获取环境变量
const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  EXPIRATION_IN = '4h',
  REFRESH_EXPIRATION_IN = '7d',
  JWT_ISSUER = 'es',
  JWT_AUD = 'es',
  JWT_STRATEGY_KEY = 'jwt',
} = process.env

// 验证必需的配置项
if (!JWT_SECRET) {
  throw new Error('缺少环境变量 JWT_SECRET 环境变量')
}

if (!JWT_REFRESH_SECRET) {
  throw new Error('缺少环境变量 JWT_REFRESH_SECRET 环境变量')
}

// 创建认证配置对象，使用更优雅的方式合并默认值和环境变量
export const AuthConfig: IAuthConfig = {
  // 必需的配置项，已在上面验证
  secret: JWT_SECRET,
  refreshSecret: JWT_REFRESH_SECRET,
  // 使用类型安全的方式合并其他配置项
  expiresIn: EXPIRATION_IN as IAuthConfig['expiresIn'],
  refreshExpiresIn: REFRESH_EXPIRATION_IN as IAuthConfig['refreshExpiresIn'],
  aud: JWT_AUD,
  iss: JWT_ISSUER,
  strategyKey: JWT_STRATEGY_KEY,
}

export const AuthConfigRegister = registerAs('auth', () => AuthConfig)
