import type { SendSmsVerifyCodeResponseBody } from '@alicloud/dypnsapi20170525'
import type {
  CheckVerifyCodeInput,
  SendVerifyCodeInput,
  SmsAliyunConfig,
  SmsConfigProvider,
} from './sms.types'
import Credential, { Config } from '@alicloud/credentials'
import Dypnsapi20170525, * as $Dypnsapi20170525 from '@alicloud/dypnsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import * as $Util from '@alicloud/tea-util'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { SmsErrorMap, SmsErrorMessages, SmsTemplateCodeEnum } from './sms.constant'
import { SMS_CONFIG_PROVIDER } from './sms.types'

/**
 * 阿里云短信验证码服务
 *
 * 功能说明:
 * - 发送短信验证码（使用阿里云短信服务）
 * - 校验短信验证码（使用阿里云接口校验）
 *
 * 配置来源:
 * - 通过 SMS_CONFIG_PROVIDER 注入配置读取器（默认由 SystemConfigModule 提供 ConfigReader）
 * - 配置更新后由 SystemConfigService 自动刷新缓存
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

  constructor(
    @Inject(SMS_CONFIG_PROVIDER)
    private readonly configProvider: SmsConfigProvider,
  ) {}

  /**
   * 获取阿里云客户端实例（单例模式）
   *
   * 配置从 ConfigReader 同步读取，当 AccessKeyId 变化时重建客户端
   *
   * @returns Dypnsapi20170525 客户端实例
   */
  private getClient(): Dypnsapi20170525 {
    const aliyunConfig = this.configProvider.getAliyunConfig()

    // 校验必要配置
    if (!aliyunConfig.accessKeyId || !aliyunConfig.accessKeySecret) {
      throw new Error(SmsErrorMessages.CONFIG_NOT_FOUND)
    }
    if (!aliyunConfig.sms?.signName) {
      throw new Error('阿里云短信签名未配置')
    }

    // 配置变更时重置客户端
    if (this.cachedAccessKeyId !== aliyunConfig.accessKeyId) {
      this.client = undefined
      this.cachedAccessKeyId = aliyunConfig.accessKeyId
    }

    // 单例创建客户端
    if (!this.client) {
      this.client = this.createClient(aliyunConfig)
    }

    return this.client
  }

  /**
   * 创建阿里云短信客户端
   *
   * @param config 阿里云配置
   * @param config.accessKeyId 阿里云 AccessKeyId
   * @param config.accessKeySecret 阿里云 AccessKeySecret
   * @param config.sms 短信配置
   * @param config.sms.endpoint 短信服务端点（可选）
   * @returns Dypnsapi20170525 客户端实例
   */
  private createClient(config: SmsAliyunConfig): Dypnsapi20170525 {
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
    // 使用配置中的端点，或默认端点
    openApiConfig.endpoint = config.sms.endpoint || 'dypnsapi.aliyuncs.com'
    return new Dypnsapi20170525(openApiConfig)
  }

  /**
   * 校验短信验证码
   *
   * 使用阿里云短信服务接口进行验证码校验，验证码由阿里云生成和管理。
   *
   * @param dto 校验请求参数
   * @returns 校验是否通过
   */
  async checkVerifyCode(dto: CheckVerifyCodeInput): Promise<boolean> {
    const { phone, code } = dto

    const client = this.getClient()
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
   * @returns 发送是否成功
   */
  async sendVerifyCode(dto: SendVerifyCodeInput): Promise<boolean> {
    const { phone, templateCode } = dto

    try {
      const { sms: smsConfig } = this.configProvider.getAliyunConfig()
      const client = this.getClient()

      const runtime = new $Util.RuntimeOptions({})

      // 使用传入的模板编码，或默认登录/注册模板编码
      const finalTemplateCode = templateCode || SmsTemplateCodeEnum.LOGIN_REGISTER

      const sendSmsVerifyCodeRequest =
        new $Dypnsapi20170525.SendSmsVerifyCodeRequest({
          phoneNumber: phone,
          signName: smsConfig.signName,
          templateCode: finalTemplateCode,
          templateParam: JSON.stringify({
            code: '##code##',
            min: '5',
          }),
          validTime: smsConfig.verifyCodeExpire,
          codeLength: smsConfig.verifyCodeLength,
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
