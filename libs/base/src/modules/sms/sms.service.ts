import type { SendSmsVerifyCodeResponseBody } from '@alicloud/dypnsapi20170525'
import Credential, { Config } from '@alicloud/credentials'
import Dypnsapi20170525, * as $Dypnsapi20170525 from '@alicloud/dypnsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import * as $Util from '@alicloud/tea-util'
import { AliyunConfigDto, SystemConfigService } from '@libs/system-config'
import { Injectable, Logger } from '@nestjs/common'
import { CheckVerifyCodeDto, SendVerifyCodeDto } from './dto/sms.dto'
import {
  defaultConfig as SmsDefaultConfig,
  SmsErrorMap,
  SmsErrorMessages,
} from './sms.constant'

/**
 * 阿里云短信验证码服务
 *
 * 功能说明:
 * - 发送短信验证码（使用阿里云短信服务）
 * - 校验短信验证码（使用阿里云接口校验）
 *
 * 配置来源:
 * - 配置从 SystemConfigService 读取，该服务内置缓存机制
 * - 配置更新后自动刷新缓存
 *
 * 客户端管理:
 * - 阿里云客户端单例，配置变更时自动重建
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)
  /** 阿里云客户端实例（单例） */
  private client?: Dypnsapi20170525
  /** 缓存的 AccessKeyId，用于检测配置变更 */
  private cachedAccessKeyId?: string

  constructor(private readonly systemConfigService: SystemConfigService) {}

  /**
   * 获取阿里云配置
   *
   * 配置从 SystemConfigService 读取，该服务内置缓存（TTL 2小时）
   * 当 AccessKeyId 变化时，会重置客户端实例
   *
   * @returns 阿里云配置对象
   * @throws 配置不存在或配置不完整时抛出异常
   */
  private async getAliyunConfig(): Promise<AliyunConfigDto> {
    const dbConfig = (await this.systemConfigService.findActiveConfig()) as any
    if (!dbConfig?.aliyunConfig) {
      throw new Error(SmsErrorMessages.CONFIG_NOT_FOUND)
    }

    const aliyunConfig = dbConfig.aliyunConfig as AliyunConfigDto
    if (!aliyunConfig.accessKeyId || !aliyunConfig.accessKeySecret) {
      throw new Error(SmsErrorMessages.CONFIG_NOT_FOUND)
    }

    // 配置变更时重置 client
    if (this.cachedAccessKeyId !== aliyunConfig.accessKeyId) {
      this.client = undefined
      this.cachedAccessKeyId = aliyunConfig.accessKeyId
    }

    return aliyunConfig
  }

  /**
   * 获取阿里云客户端实例（单例模式）
   *
   * @returns Dypnsapi20170525 客户端实例
   */
  private async getClient(): Promise<Dypnsapi20170525> {
    if (this.client) {
      return this.client
    }

    const config = await this.getAliyunConfig()

    if (!config.accessKeyId || !config.accessKeySecret) {
      throw new Error('阿里云短信 AccessKey 未配置')
    }
    if (!config.sms?.signName) {
      throw new Error('阿里云短信配置不完整')
    }

    this.client = this.createClient(config)
    return this.client
  }

  /**
   * 创建阿里云短信客户端
   * @returns Dypnsapi20170525客户端实例
   */
  private createClient(config: AliyunConfigDto): Dypnsapi20170525 {
    const credential = new Credential(
      new Config({
        type: 'access_key',
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
      }),
    )
    const openApiConfig = new $OpenApi.Config({
      credential,
    })
    openApiConfig.endpoint = SmsDefaultConfig.endpoint
    return new Dypnsapi20170525(openApiConfig)
  }

  /**
   * 校验短信验证码
   *
   * 使用阿里云短信服务接口进行验证码校验，验证码由阿里云生成和管理。
   *
   * @param dto 校验请求参数
   * @param dto.phone 手机号
   * @param dto.code 验证码
   * @returns 校验是否通过
   */
  async checkVerifyCode(dto: CheckVerifyCodeDto): Promise<boolean> {
    const { phone, code } = dto

    await this.getAliyunConfig()
    const client = await this.getClient()
    const runtime = new $Util.RuntimeOptions({})
    const checkSmsVerifyCodeRequest =
      new $Dypnsapi20170525.CheckSmsVerifyCodeRequest({
        phoneNumber: phone,
        verifyCode: code,
      })

    const resp = await client.checkSmsVerifyCodeWithOptions(
      checkSmsVerifyCodeRequest,
      runtime,
    )

    const response =
      resp.body as $Dypnsapi20170525.CheckSmsVerifyCodeResponseBody

    const isPassed = response.model?.verifyResult === 'PASS'
    this.logger.log(
      `验证码核验${isPassed ? '成功' : '失败'} - 手机号: ${phone}`,
    )

    return isPassed
  }

  /**
   * 发送短信验证码
   *
   * 使用阿里云短信服务发送验证码，验证码由阿里云生成、发送和校验。
   * 验证码有效期和长度从系统配置读取。
   *
   * @param dto 发送请求参数
   * @param dto.phone 手机号
   * @param dto.templateCode 短信模板编码（可选，默认使用系统配置）
   * @returns 发送是否成功
   */
  async sendVerifyCode(dto: SendVerifyCodeDto): Promise<boolean> {
    const { phone, templateCode = SmsDefaultConfig.templateCode } = dto

    try {
      const config = await this.getAliyunConfig()
      const client = await this.getClient()

      const runtime = new $Util.RuntimeOptions({})

      const sendSmsVerifyCodeRequest =
        new $Dypnsapi20170525.SendSmsVerifyCodeRequest({
          phoneNumber: phone,
          signName: config.sms.signName,
          templateCode,
          templateParam: JSON.stringify({
            code: '##code##',
            min: '5',
          }),
          validTime: config.sms.verifyCodeExpire,
          codeLength: config.sms.verifyCodeLength,
        })
      const resp = await client.sendSmsVerifyCodeWithOptions(
        sendSmsVerifyCodeRequest,
        runtime,
      )

      const response = resp.body as SendSmsVerifyCodeResponseBody

      if (!response.code || response.code !== 'OK') {
        throw new Error(SmsErrorMap[response?.code || '验证码服务异常'])
      }

      this.logger.log(`验证码发送成功 - 手机号: ${phone}`)

      return true
    } catch (error) {
      this.logger.error(`验证码发送失败 - 手机号: ${phone}`, error)
      return false
    }
  }
}
