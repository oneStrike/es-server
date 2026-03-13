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
