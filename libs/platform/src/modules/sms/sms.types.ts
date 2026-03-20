export const SMS_CONFIG_PROVIDER = 'SMS_CONFIG_PROVIDER'

export interface SmsAliyunConfig {
  accessKeyId: string
  accessKeySecret: string
  sms: {
    endpoint?: string
    signName: string
    verifyCodeExpire: number
    verifyCodeLength: number
  }
}

export interface SmsConfigProvider {
  getAliyunConfig: () => SmsAliyunConfig
}

/**
 * 发送短信验证码入参。
 * - 用于指定手机号与可选模板编码
 */
export interface SendVerifyCodeInput {
  phone: string
  templateCode?: string
}

/**
 * 校验短信验证码入参。
 * - 用于指定手机号和验证码进行校验
 */
export interface CheckVerifyCodeInput {
  phone: string
  code: string
}
