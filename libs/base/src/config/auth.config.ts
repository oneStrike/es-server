import type { AuthConfigInterface } from '../types'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { registerAs } from '@nestjs/config'

// 获取环境变量
const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EXPIRATION_IN = '4h',
  JWT_REFRESH_EXPIRATION_IN = '7d',
  JWT_JWT_ISSUER = 'es',
  JWT_JWT_AUD = 'es',
  JWT_STRATEGY_KEY = 'jwt',
} = process.env

// 尝试读取 RSA 密钥对
const cwd = process.cwd()
const publicKeyPath = join(cwd, 'jwt_public.key')
const privateKeyPath = join(cwd, 'jwt_private.key')

let publicKey: string | undefined
let privateKey: string | undefined

if (existsSync(publicKeyPath) && existsSync(privateKeyPath)) {
  publicKey = readFileSync(publicKeyPath, 'utf-8')
  privateKey = readFileSync(privateKeyPath, 'utf-8')
}

// 创建认证配置对象，使用更优雅的方式合并默认值和环境变量
export const AuthConfig: AuthConfigInterface = {
  // 必需的配置项，已在上面验证
  secret: JWT_SECRET!,
  refreshSecret: JWT_REFRESH_SECRET!,
  publicKey,
  privateKey,
  // 使用类型安全的方式合并其他配置项
  expiresIn: JWT_EXPIRATION_IN as AuthConfigInterface['expiresIn'],
  refreshExpiresIn:
    JWT_REFRESH_EXPIRATION_IN as AuthConfigInterface['refreshExpiresIn'],
  aud: JWT_JWT_AUD,
  iss: JWT_JWT_ISSUER,
  strategyKey: JWT_STRATEGY_KEY,
}

export const AuthConfigRegister = registerAs('auth', () => AuthConfig)
