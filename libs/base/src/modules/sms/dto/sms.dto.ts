import { ValidateEnum, ValidateString } from '@libs/base/decorators'
import { PickType } from '@nestjs/swagger'
import { SmsTemplateCodeEnum } from '../sms.constant'

/**
 * 验证码发送请求DTO
 */
export class SendVerifyCodeDto {
  @ValidateString({
    description: '接收短信的手机号码',
    example: '13800138000',
    required: true,
  })
  phone!: string

  @ValidateEnum({
    description:
      '短信模板代码, 可选值: 100001（登录/注册），100002（修改绑定手机号），100003（重置密码），100004（绑定新手机号），100005（验证绑定手机号）',
    example: '100001',
    required: false,
    default: SmsTemplateCodeEnum.LOGIN_REGISTER,
    enum: SmsTemplateCodeEnum,
  })
  templateCode?: string
}

/**
 * 校验验证码DTO
 */
export class CheckVerifyCodeDto extends PickType(SendVerifyCodeDto, ['phone']) {
  @ValidateString({
    description: '验证码',
    example: '123456',
    required: true,
  })
  code!: string
}
