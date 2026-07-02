import type { SmsTemplateCodeEnum } from '@libs/platform/modules/sms/sms.constant'

/** 注册流程的可选控制参数，用于跳过验证码校验等场景。 */
export interface RegisterOptions {
  skipVerifyCode?: boolean
}

/** 登录验证码校验输入，供 validateLoginVerifyCode 方法使用。 */
export interface LoginVerifyCodeInput {
  phone: string
  code: string
  templateCode: SmsTemplateCodeEnum
}
