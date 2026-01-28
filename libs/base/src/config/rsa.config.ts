import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { Logger } from '@nestjs/common'
import { registerAs } from '@nestjs/config'

export const RsaConfigRegister = registerAs('rsa', () => {
  const logger = new Logger('RsaConfig')
  const cwd = process.cwd()

  // 1. 定义路径 (优先环境变量 -> 默认路径)
  const publicKeyPath = resolve(
    process.env.RSA_PUBLIC_KEY_PATH || join(cwd, 'jwt_public.key'),
  )
  const privateKeyPath = resolve(
    process.env.RSA_PRIVATE_KEY_PATH || join(cwd, 'jwt_private.key'),
  )

  // 2. 检查并自动生成密钥 (如果不存在)
  if (!existsSync(privateKeyPath) || !existsSync(publicKeyPath)) {
    logger.warn('RSA keys not found. Generating new key pair...')
    try {
      // 确保目录存在
      const privateDir = dirname(privateKeyPath)
      const publicDir = dirname(publicKeyPath)

      if (!existsSync(privateDir)) {
        mkdirSync(privateDir, { recursive: true })
      }
      if (publicDir !== privateDir && !existsSync(publicDir)) {
        mkdirSync(publicDir, { recursive: true })
      }

      // 生成 2048位 RSA 密钥对
      const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      })

      writeFileSync(privateKeyPath, privateKey)
      writeFileSync(publicKeyPath, publicKey)
      logger.log(`RSA keys generated successfully`)
    } catch (error) {
      logger.error('Failed to generate RSA keys', error)
      throw error
    }
  }

  // 3. 读取密钥内容
  let publicKey: string | undefined
  let privateKey: string | undefined

  if (existsSync(publicKeyPath) && existsSync(privateKeyPath)) {
    publicKey = readFileSync(publicKeyPath, 'utf-8')
    privateKey = readFileSync(privateKeyPath, 'utf-8')
  }

  // 4. 支持环境变量覆盖
  if (process.env.RSA_PUBLIC_KEY) {
    publicKey = process.env.RSA_PUBLIC_KEY
  }
  if (process.env.RSA_PRIVATE_KEY) {
    privateKey = process.env.RSA_PRIVATE_KEY
  }

  return {
    publicKey,
    privateKey,
    publicKeyPath,
    privateKeyPath,
  }
})
