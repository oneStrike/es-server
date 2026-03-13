import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { registerAs } from '@nestjs/config'

export const RsaConfigRegister = registerAs('rsa', () => {
  const cwd = process.cwd()
  const secretsDir = join(cwd, 'secrets')

  // 1. 定义路径
  const publicKeyPath = resolve(join(secretsDir, 'jwt_public.key'))
  const privateKeyPath = resolve(join(secretsDir, 'jwt_private.key'))

  // 2. 检查并自动生成密钥 (如果不存在)
  if (!existsSync(privateKeyPath) || !existsSync(publicKeyPath)) {
    // 确保目录存在
    if (!existsSync(secretsDir)) {
      mkdirSync(secretsDir, { recursive: true })
    }

    // 生成 2048位 RSA 密钥对
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    })

    writeFileSync(privateKeyPath, privateKey)
    writeFileSync(publicKeyPath, publicKey)
  }

  // 3. 读取密钥内容
  const publicKey = readFileSync(publicKeyPath, 'utf-8')
  const privateKey = readFileSync(privateKeyPath, 'utf-8')

  return {
    publicKey,
    privateKey,
    publicKeyPath,
    privateKeyPath,
  }
})
