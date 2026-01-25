import type { SendSmsVerifyCodeResponseBody } from '@alicloud/dypnsapi20170525';
import type { AliyunConfigInterface } from '@libs/base/config'
import Credential, { Config } from '@alicloud/credentials';
import Dypnsapi20170525, * as $Dypnsapi20170525 from '@alicloud/dypnsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import * as $Util from '@alicloud/tea-util'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SendVerifyCodeDto, VerifyCodeDto } from './dto/sms.dto'
import { ErrorMap, ErrorMessages } from './sms.constant'

/**
 * 阿里云短信服务
 * 提供短信发送、验证码发送等功能
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)
  private readonly config: AliyunConfigInterface
  private readonly client: Dypnsapi20170525

  constructor(private readonly configService: ConfigService) {
    const aliyunConfig = this.configService.get<AliyunConfigInterface>('aliyun')
    if (!aliyunConfig) {
      throw new Error(ErrorMessages.CONFIG_NOT_FOUND)
    }
    this.config = aliyunConfig
    this.client = this.createClient()
  }

  /**
   * 创建阿里云短信客户端
   * @returns Dypnsapi20170525客户端实例
   */
  private createClient(): Dypnsapi20170525 {
    const credential = new Credential(
      new Config({
        type: 'access_key',
        accessKeyId: this.config.accessKeyId,
        accessKeySecret: this.config.accessKeySecret,
      })
    )
    const config = new $OpenApi.Config({
      credential,
    })
    config.endpoint = this.config.sms.endpoint
    return new Dypnsapi20170525(config)
  }

  /**
   * 执行短信发送请求
   * @param dto 短信发送请求DTO
   * @returns 发送结果
   */
  async sendSmsRequest(dto: SendVerifyCodeDto) {
    const { phoneNumber, templateCode } = dto

    const runtime = new $Util.RuntimeOptions({})

    const sendSmsVerifyCodeRequest = new $Dypnsapi20170525.SendSmsVerifyCodeRequest({
      phoneNumber,
      signName: this.config.sms.signName,
      templateCode,
      templateParam: JSON.stringify({ code: "##code##", min: "5" }),
      codeLength: 6,
    })

    try {
      const resp = await this.client.sendSmsVerifyCodeWithOptions(
        sendSmsVerifyCodeRequest,
        runtime,
      )

      const response = resp.body as SendSmsVerifyCodeResponseBody

      if (!response.code || response.code !== 'OK') {
        throw new Error(ErrorMap[response?.code || '验证码服务异常'])
      }

      this.logger.log(
        `验证码发送成功 - 手机号: ${phoneNumber}`,
      )

      return '验证码发送成功'
    } catch (error) {
      this.logger.error(`验证码发送失败 - 手机号: ${phoneNumber}`, error)
      throw error
    }
  }

  /**
   * 核验短信验证码
   * @param dto 核验验证码请求DTO
   * @returns 核验结果
   */
  async checkVerifyCode(dto: VerifyCodeDto) {
    const { phoneNumber, verifyCode } = dto

    const runtime = new $Util.RuntimeOptions({})

    const checkSmsVerifyCodeRequest = new $Dypnsapi20170525.CheckSmsVerifyCodeRequest({
      phoneNumber,
      verifyCode
    })

    try {
      const resp = await this.client.checkSmsVerifyCodeWithOptions(
        checkSmsVerifyCodeRequest,
        runtime,
      )

      const response = resp.body as any

      this.logger.log(
        `验证码核验${response.model?.verifyResult === 'PASS' ? '成功' : '失败'} - 手机号: ${phoneNumber}`,
      )

      return response
    } catch (error) {
      this.logger.error(`验证码核验失败 - 手机号: ${phoneNumber}`, error)
      throw new Error(ErrorMap[error.code] || '验证码服务异常')
    }
  }
}
