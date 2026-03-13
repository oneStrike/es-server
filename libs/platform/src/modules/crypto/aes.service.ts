import { Buffer } from 'node:buffer'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
} from 'node:crypto'
import { promisify } from 'node:util'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const scryptAsync = promisify(scrypt)

/**
 * AES 对称加密服务
 * 用于敏感数据的加密存储和解密读取
 * 采用 AES-256-CTR 算法
 */
@Injectable()
export class AesService {
  private readonly algorithm = 'aes-256-ctr'
  // 默认密钥，生产环境应通过环境变量覆盖
  private readonly defaultSecret = 'es-server-default-secret-key-2024'

  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取加密密钥
   */
  private getSecretKey(): string {
    return this.configService.get<string>('app.secret', this.defaultSecret)
  }

  /**
   * 加密数据
   * @param text 明文
   * @returns 加密后的十六进制字符串 (iv:content)
   */
  async encrypt(text: string): Promise<string> {
    const secret = this.getSecretKey()
    // 生成随机初始化向量
    const iv = randomBytes(16)

    // 使用 scrypt 从 secret 生成 32 字节密钥
    const key = (await scryptAsync(secret, 'salt', 32)) as Buffer

    const cipher = createCipheriv(this.algorithm, key, iv)
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()])

    // 返回 iv:content 格式，以便解密时提取 iv
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`
  }

  /**
   * 解密数据
   * @param encryptedText 加密后的字符串 (iv:content)
   * @returns 明文
   */
  async decrypt(encryptedText: string): Promise<string> {
    const [ivHex, contentHex] = encryptedText.split(':')
    if (!ivHex || !contentHex) {
      throw new Error('无效的加密数据格式')
    }

    const secret = this.getSecretKey()
    const iv = Buffer.from(ivHex, 'hex')
    const key = (await scryptAsync(secret, 'salt', 32)) as Buffer

    const decipher = createDecipheriv(this.algorithm, key, iv)
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(contentHex, 'hex')),
      decipher.final(),
    ])

    return decrypted.toString()
  }
}
