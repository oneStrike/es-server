import type { SendSmsVerifyCodeResponseBody } from '@alicloud/dypnsapi20170525'
import type { AliyunConfigInterface } from '@libs/base/config'
import Credential, { Config } from '@alicloud/credentials'
import Dypnsapi20170525, * as $Dypnsapi20170525 from '@alicloud/dypnsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import * as $Util from '@alicloud/tea-util'
import { AliyunConfigDto, SystemConfigService } from '@libs/system-config'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CheckVerifyCodeDto, SendVerifyCodeDto } from './dto/sms.dto'
import {
  defaultConfig,
  defaultConfig as SmsDefaultConfig,
  SmsErrorMap,
  SmsErrorMessages,
} from './sms.constant'

/**
 * 阿里云短信服务
 * 提供短信发送、验证码发送等功能
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)
  private readonly defaultConfig?: AliyunConfigInterface
  private client?: Dypnsapi20170525
  private lastConfigUpdateTime = 0
  private cachedConfig: AliyunConfigDto | null = null

  constructor(
    private readonly configService: ConfigService,
    private readonly systemConfigService: SystemConfigService,
  ) {
    this.defaultConfig = this.configService.get<AliyunConfigInterface>('aliyun')
  }

  /**
   * 获取生效的配置 (优先 DB，其次 Env)
   */
  private async getEffectiveConfig(): Promise<
    AliyunConfigDto | AliyunConfigInterface
  > {
    const now = Date.now()
    // 简单的内存缓存，1分钟刷新一次
    if (this.cachedConfig && now - this.lastConfigUpdateTime < 60000) {
      return this.cachedConfig
    }

    try {
      const dbConfig = (await this.systemConfigService.findActiveConfig()) as any
      if (dbConfig?.aliyunConfig) {
        const aliyunConfig = dbConfig.aliyunConfig as AliyunConfigDto
        // 简单校验必要字段
        if (aliyunConfig.accessKeyId && aliyunConfig.accessKeySecret) {
          this.cachedConfig = aliyunConfig
          this.lastConfigUpdateTime = now
          // 如果配置变更，重置 client
          this.client = undefined
          return aliyunConfig
        }
      }
    } catch (error) {
      this.logger.warn('从数据库读取配置失败，将使用环境变量配置', error)
    }

    if (this.defaultConfig) {
      return this.defaultConfig
    }

    throw new Error(SmsErrorMessages.CONFIG_NOT_FOUND)
  }

  private async getClient(
    config?: AliyunConfigDto | AliyunConfigInterface,
  ): Promise<Dypnsapi20170525> {
    if (this.client) {
      return this.client
    }

    if (!config) {
      config = await this.getEffectiveConfig()
    }

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
  private createClient(
    config: AliyunConfigDto | AliyunConfigInterface,
  ): Dypnsapi20170525 {
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

  // 模拟验证码校验（实际业务中通常由 Redis 校验，这里仅为占位或调用第三方）
  async checkVerifyCode(dto: CheckVerifyCodeDto) {
    const { phone, code } = dto

    try {
      const config = await this.getEffectiveConfig()
      const client = await this.getClient(config)
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

      this.logger.log(
        `验证码核验${response.model?.verifyResult === 'PASS' ? '成功' : '失败'} - 手机号: ${phone}`,
      )

      return true
    } catch (error) {
      this.logger.error(`验证码核验失败 - 手机号: ${phone}`, error)
      return false
    }
  }

  /**
   * 执行短信发送请求
   * @param dto 短信发送请求DTO
   * @returns 发送结果
   */
  async sendVerifyCode(dto: SendVerifyCodeDto) {
    const { phone, templateCode = defaultConfig.templateCode } = dto

    try {
      // 并行获取 client 和 config
      const config = await this.getEffectiveConfig()
      const client = await this.getClient(config)

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
