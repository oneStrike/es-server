import type { SendSmsVerifyCodeResponseBody } from '@alicloud/dypnsapi20170525'
import type { AliyunConfigInterface } from '@libs/base/config'
import Credential, { Config } from '@alicloud/credentials'
import Dypnsapi20170525, * as $Dypnsapi20170525 from '@alicloud/dypnsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import * as $Util from '@alicloud/tea-util'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CheckVerifyCodeDto, SendVerifyCodeDto } from './dto/sms.dto'
import { SmsErrorMap, SmsErrorMessages } from './sms.constant'

/**
 * 阿里云短信服务
 * 提供短信发送、验证码发送等功能
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)
  private readonly config?: AliyunConfigInterface
  private client?: Dypnsapi20170525

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<AliyunConfigInterface>('aliyun')
  }

  private getClient(): Dypnsapi20170525 {
    if (this.client) {
      return this.client
    }
    if (!this.config) {
      throw new Error(SmsErrorMessages.CONFIG_NOT_FOUND)
    }
    if (!this.config.accessKeyId || !this.config.accessKeySecret) {
      throw new Error('阿里云短信 AccessKey 未配置')
    }
    if (!this.config.sms?.endpoint || !this.config.sms?.signName) {
      throw new Error('阿里云短信配置不完整')
    }
    this.client = this.createClient()
    return this.client
  }

  /**
   * 创建阿里云短信客户端
   * @returns Dypnsapi20170525客户端实例
   */
  private createClient(): Dypnsapi20170525 {
    const credential = new Credential(
      new Config({
        type: 'access_key',
        accessKeyId: this.config!.accessKeyId,
        accessKeySecret: this.config!.accessKeySecret,
      }),
    )
    const config = new $OpenApi.Config({
      credential,
    })
    config.endpoint = this.config!.sms.endpoint
    return new Dypnsapi20170525(config)
  }

  /**
   * 执行短信发送请求
   * @param dto 短信发送请求DTO
   * @returns 发送结果
   */
  async sendVerifyCode(dto: SendVerifyCodeDto) {
    const { phone, templateCode } = dto

    try {
      const client = this.getClient()
      const config = this.config!
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
      console.log('🚀 ~ SmsService ~ sendVerifyCode ~ error:', error)
      this.logger.error(`验证码发送失败 - 手机号: ${phone}`, error)
      return false
    }
  }

  /**
   * 核验短信验证码
   * @param dto 核验验证码请求DTO
   * @returns 核验结果
   */
  async checkVerifyCode(dto: CheckVerifyCodeDto) {
    const { phone, code } = dto

    try {
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

      this.logger.log(
        `验证码核验${response.model?.verifyResult === 'PASS' ? '成功' : '失败'} - 手机号: ${phone}`,
      )

      return true
    } catch (error) {
      this.logger.error(`验证码核验失败 - 手机号: ${phone}`, error)
      return false
    }
  }
}
