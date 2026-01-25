import process from 'node:process'
import { registerAs } from '@nestjs/config'

/**
 * 阿里云配置
 */
export const AliyunConfig = {
  /**
   * 短信服务配置
   */
  sms: {
    /** 终端节点 */
    endpoint: process.env.ALIYUN_SMS_ENDPOINT || 'dypnsapi.aliyuncs.com',
    /** 短信签名名称 */
    signName: process.env.ALIYUN_SMS_SIGN_NAME || '',
  },
  /** AccessKey ID */
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '',
  /** AccessKey Secret */
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '',
}

export type AliyunConfigInterface = typeof AliyunConfig

/**
 * 注册阿里云配置
 */
export const AliyunConfigRegister = registerAs('aliyun', () => AliyunConfig)
