export const SMS_CONFIG_PROVIDER = 'SMS_CONFIG_PROVIDER'

/** 稳定领域类型 `SmsAliyunConfig`。仅供内部领域/服务链路复用，避免重复定义。 */
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

/** 稳定领域类型 `SmsConfigProvider`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface SmsConfigProvider {
  getAliyunConfig: () => SmsAliyunConfig
}
