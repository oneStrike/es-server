import type { DynamicModule, Provider, Type } from '@nestjs/common'

/**
 * 短信模块配置提供器注入 token。
 */
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

/** 阿里云短信模块动态注册选项，允许调用方追加 imports 和 providers。 */
export interface SmsModuleOptions {
  imports?: Array<DynamicModule | Type<object>>
  providers?: Provider[]
}
