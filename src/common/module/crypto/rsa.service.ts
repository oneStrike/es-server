import { Buffer } from 'node:buffer'
import { constants, privateDecrypt, publicEncrypt } from 'node:crypto'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RsaKeyType } from '@/common/enum/rsa'
import { LoggerFactoryService } from '@/common/module/logger/logger-factory.service'
import { CustomLoggerService } from '@/common/module/logger/logger.service'
/**
 * RSA密钥对
 */
export interface RsaKeyPair {
  publicKey: string
  privateKey: string
}

/**
 * RSA服务
 * 负责初始化RSA密钥对并提供加密解密功能
 */
@Injectable()
export class RsaService implements OnModuleInit {
  private static instance: RsaService
  private keyPairs: Map<RsaKeyType, RsaKeyPair> = new Map()
  private logger: CustomLoggerService

  constructor(
    private configService: ConfigService,
    private loggerFactory: LoggerFactoryService,
  ) {
    this.logger = this.loggerFactory.createGlobalLogger('RsaService')
  }

  /**
   * 模块初始化时，初始化RSA密钥对
   */
  async onModuleInit() {
    await this.initialize()
  }

  /**
   * 初始化RSA密钥对
   * 检查环境变量中是否有admin、client、login的公私钥配置
   * 如果没有则生成，开发环境写入环境变量文件，生产环境写入系统环境变量
   */
  public async initialize(): Promise<void> {
    // 初始化Admin RSA密钥对
    await this.initializeKeyPair(RsaKeyType.ADMIN)

    // 初始化Client RSA密钥对
    await this.initializeKeyPair(RsaKeyType.CLIENT)

    // 初始化Login RSA密钥对
    await this.initializeKeyPair(RsaKeyType.LOGIN)
  }

  /**
   * 初始化指定类型的RSA密钥对
   * @param keyType 密钥类型
   */
  private async initializeKeyPair(keyType: RsaKeyType): Promise<void> {
    const prefix = `${keyType}_RSA`
    const publicKeyEnv = this.configService.get<string>(`${prefix}_PUBLIC_KEY`)
    const privateKeyEnv = this.configService.get<string>(
      `${prefix}_PRIVATE_KEY`,
    )

    // 如果环境变量中直接配置了公私钥，则使用环境变量中的公私钥
    if (publicKeyEnv && privateKeyEnv) {
      this.keyPairs.set(keyType, {
        publicKey: publicKeyEnv,
        privateKey: privateKeyEnv,
      })
      return
    }

    // 如果只配置了公钥，则只能用于加密，不能用于解密
    if (publicKeyEnv) {
      this.keyPairs.set(keyType, {
        publicKey: publicKeyEnv,
        privateKey: '',
      })
      return
    }

    // 如果无法从文件或环境变量读取，则抛出错误，要求外部提供密钥
    const message = `${keyType} RSA密钥未配置。请通过环境变量 ${prefix}_PUBLIC_KEY / ${prefix}_PRIVATE_KEY 提供密钥。`
    this.logger.logSecurity(message, 'error', { keyType })
    throw new Error(message)
  }

  /**
   * 确保目录存在
   * @param filePath 文件路径
   */
  // 统一仅从环境变量读取密钥，不进行任何文件系统操作

  /**
   * 生成RSA密钥对
   * @returns RSA密钥对
   */
  // 统一仅从环境变量读取密钥，不进行运行时生成

  /**
   * 获取RSA公钥
   * @param keyType 密钥类型，默认为通用密钥
   * @returns RSA公钥
   */
  getPublicKey(keyType: RsaKeyType): string {
    const keyPair = this.keyPairs.get(keyType)
    if (!keyPair) {
      throw new Error(`${keyType} RSA密钥对未初始化`)
    }
    return keyPair.publicKey
  }

  /**
   * 获取Admin RSA公钥
   * @returns Admin RSA公钥
   */
  getAdminPublicKey(): string {
    return this.getPublicKey(RsaKeyType.ADMIN)
  }

  /**
   * 获取Client RSA公钥
   * @returns Client RSA公钥
   */
  getClientPublicKey(): string {
    return this.getPublicKey(RsaKeyType.CLIENT)
  }

  /**
   * 获取Login RSA公钥
   * @returns Login RSA公钥
   */
  getLoginPublicKey(): string {
    return this.getPublicKey(RsaKeyType.LOGIN)
  }

  /**
   * 使用RSA公钥加密数据
   * @param data 要加密的数据
   * @param keyType 密钥类型，默认为通用密钥
   * @returns 加密后的数据（Base64编码）
   */
  encrypt(data: string, keyType: RsaKeyType): string {
    const keyPair = this.keyPairs.get(keyType)
    if (!keyPair) {
      throw new Error(`${keyType} RSA密钥对未初始化`)
    }

    const buffer = Buffer.from(data, 'utf8')
    const encrypted = publicEncrypt(
      {
        key: keyPair.publicKey,
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
   * 使用Login RSA公钥加密数据
   * @param data 要加密的数据
   * @returns 加密后的数据
   */
  encryptWithLogin(data: string): string {
    return this.encrypt(data, RsaKeyType.LOGIN)
  }

  /**
   * 使用RSA私钥解密数据
   * @param encryptedData 加密后的数据（Base64编码）
   * @param keyType 密钥类型，默认为通用密钥
   * @returns 解密后的数据
   */
  decrypt(encryptedData: string, keyType: RsaKeyType): string {
    const keyPair = this.keyPairs.get(keyType)
    if (!keyPair || !keyPair.privateKey) {
      throw new Error(`${keyType} RSA私钥未初始化`)
    }
    const buffer = Buffer.from(encryptedData, 'base64')
    const decrypted = privateDecrypt(
      {
        key: keyPair.privateKey,
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

  /**
   * 使用Login RSA私钥解密数据
   * @param encryptedData 加密后的数据
   * @returns 解密后的数据
   */
  decryptWithLogin(encryptedData: string): string {
    return this.decrypt(encryptedData, RsaKeyType.LOGIN)
  }
}
