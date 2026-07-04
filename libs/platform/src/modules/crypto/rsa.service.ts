import { Buffer } from 'node:buffer'
import { constants, privateDecrypt, publicEncrypt } from 'node:crypto'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * RSA 非对称加密服务。
 * 供认证链路对客户端密码等敏感数据进行加密传输。
 */
@Injectable()
export class RsaService {
  constructor(private configService: ConfigService) {}

  // 获取配置中的 RSA 公钥。
  getPublicKey(): string | undefined {
    return this.configService.get<string>('rsa.publicKey')
  }

  // 获取配置中的 RSA 私钥。
  getPrivateKey(): string | undefined {
    return this.configService.get<string>('rsa.privateKey')
  }

  // 使用 RSA 公钥加密数据，返回 Base64 编码字符串。
  encrypt(data: string): string {
    const publicKey = this.getPublicKey()
    if (!publicKey) {
      throw new InternalServerErrorException('RSA 公钥未配置')
    }
    const buffer = Buffer.from(data, 'utf8')
    const encrypted = publicEncrypt(
      {
        key: publicKey,
        // 修改填充方式为RSA_PKCS1_OAEP_PADDING
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        // 指定哈希算法
        oaepHash: 'sha256',
      },
      buffer,
    )

    return encrypted.toString('base64')
  }

  // 使用 RSA 私钥解密 Base64 编码的密文。
  decrypt(encryptedData: string): string {
    const privateKey = this.getPrivateKey()
    if (!privateKey) {
      throw new InternalServerErrorException('RSA 私钥未配置')
    }
    try {
      const buffer = Buffer.from(encryptedData, 'base64')
      const decrypted = privateDecrypt(
        {
          key: privateKey,
          // 替换填充方式为RSA_PKCS1_OAEP_PADDING
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          // 指定哈希算法
          oaepHash: 'sha256',
        },
        buffer,
      )
      return decrypted.toString('utf8')
    } catch {
      throw new BadRequestException('密码解密失败')
    }
  }

  // decrypt 的语义化别名，供调用方表达“使用私钥解密”意图。
  decryptWith(encryptedData: string): string {
    return this.decrypt(encryptedData)
  }
}
