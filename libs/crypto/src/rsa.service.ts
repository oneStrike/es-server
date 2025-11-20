import { Buffer } from 'node:buffer'
import { constants, privateDecrypt, publicEncrypt } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
/**
 * RSA密钥类型
 */
export enum RsaKeyType {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
}

/**
 * RSA服务
 */
@Injectable()
export class RsaService {
  constructor(private configService: ConfigService) {}

  /**
   * 获取Admin RSA公钥
   * @returns Admin RSA公钥
   */
  getAdminPublicKey() {
    return this.configService.get('ADMIN_RSA_PUBLIC_KEY')
  }

  /**
   * 获取Admin RSA 私钥
   * @returns Admin RSA 私钥
   */
  getAdminPrivateKey() {
    return this.configService.get('ADMIN_RSA_PRIVATE_KEY')
  }

  /**
   * 获取Client RSA 私钥
   * @returns Client RSA 私钥
   */
  getClientPrivateKey() {
    return this.configService.get('CLIENT_RSA_PRIVATE_KEY')
  }

  /**
   * 获取Client RSA公钥
   * @returns Client RSA公钥
   */
  getClientPublicKey() {
    return this.configService.get('CLIENT_RSA_PUBLIC_KEY')
  }

  /**
   * 使用RSA公钥加密数据
   * @param data 要加密的数据
   * @param keyType 密钥类型，默认为通用密钥
   * @returns 加密后的数据（Base64编码）
   */
  encrypt(data: string, keyType: RsaKeyType): string {
    const publicKey =
      keyType === RsaKeyType.ADMIN
        ? this.getAdminPublicKey()
        : this.getClientPublicKey()
    if (!publicKey) {
      throw new Error(`${keyType} RSA密钥对未初始化`)
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

  /**
   * 使用Admin RSA公钥加密数据
   * @param data 要加密的数据
   * @returns 加密后的数据
   */
  encryptWithAdmin(data: string): string {
    return this.encrypt(data, RsaKeyType.ADMIN)
  }

  /**
   * 使用Client RSA公钥加密数据
   * @param data 要加密的数据
   * @returns 加密后的数据
   */
  encryptWithClient(data: string): string {
    return this.encrypt(data, RsaKeyType.CLIENT)
  }

  /**
   * 使用RSA私钥解密数据
   * @param encryptedData 加密后的数据（Base64编码）
   * @param keyType 密钥类型，默认为通用密钥
   * @returns 解密后的数据
   */
  decrypt(encryptedData: string, keyType: RsaKeyType): string {
    const privateKey =
      keyType === RsaKeyType.ADMIN
        ? this.getAdminPrivateKey()
        : this.getClientPrivateKey()
    if (!privateKey) {
      throw new Error(`${keyType} RSA私钥未初始化`)
    }
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
  }

  /**
   * 使用Admin RSA私钥解密数据
   * @param encryptedData 加密后的数据
   * @returns 解密后的数据
   */
  decryptWithAdmin(encryptedData: string): string {
    return this.decrypt(encryptedData, RsaKeyType.ADMIN)
  }

  /**
   * 使用Client RSA私钥解密数据
   * @param encryptedData 加密后的数据
   * @returns 解密后的数据
   */
  decryptWithClient(encryptedData: string): string {
    return this.decrypt(encryptedData, RsaKeyType.CLIENT)
  }
}
