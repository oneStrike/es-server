import process from 'node:process'
import { registerAs } from '@nestjs/config'

const { RSA_PUBLIC_KEY, RSA_PRIVATE_KEY } = process.env

export const RsaConfig = {
  // 数据库连接配置
  publicKey: RSA_PUBLIC_KEY,
  privateKey: RSA_PRIVATE_KEY,
}

export const RsaConfigRegister = registerAs('rsa', () => RsaConfig)
