import { Buffer } from 'node:buffer'
import { constants, privateDecrypt, publicEncrypt } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * RSA服务
 */
@Injectable()
export class RsaService {
  constructor(private configService: ConfigService) {}

  /**
   * 获取 RSA公钥
   * @returns RSA公钥
   */
  getPublicKey() {
    return this.configService.get('rsa.publicKey')
  }

  /**
   * 获取 RSA 私钥
   * @returns RSA 私钥
   */
  getPrivateKey() {
    return this.configService.get('rsa.privateKey')
  }

  /**
   * 使用RSA公钥加密数据
   * @param data 要加密的数据
   * @param keyType 密钥类型，默认为通用密钥
   * @returns 加密后的数据（Base64编码）
   */
  encrypt(data: string): string {
    const buffer = Buffer.from(data, 'utf8')
    const encrypted = publicEncrypt(
      {
        key: this.getPublicKey(),
        // 修改填充方式为RSA_PKCS1_OAEP_PADDING
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        // 指定哈希算法
        oaepHash: 'sha256',
      },
      buffer,
    )

    return encrypted.toString('base64')
  }

  /**
   * 使用RSA私钥解密数据
   * @param encryptedData 加密后的数据（Base64编码）
   * @returns 解密后的数据
   */
  decrypt(encryptedData: string): string {
    const buffer = Buffer.from(encryptedData, 'base64')
    const decrypted = privateDecrypt(
      {
        key: this.getPrivateKey(),
        // 替换填充方式为RSA_PKCS1_OAEP_PADDING
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        // 指定哈希算法
        oaepHash: 'sha256',
      },
      buffer,
    )

    return decrypted.toString('utf8')
  }

  /**
   * 使用 RSA私钥解密数据
   * @param encryptedData 加密后的数据
   * @returns 解密后的数据
   */
  decryptWith(encryptedData: string): string {
    return this.decrypt(encryptedData)
  }
}
