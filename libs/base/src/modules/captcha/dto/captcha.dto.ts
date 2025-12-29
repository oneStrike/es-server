import { ValidateString } from '@libs/base/decorators'

export class CaptchaDto {
  @ValidateString({
    description: '验证码,base64格式',
    example: '1234',
    required: true,
  })
  captcha!: string

  @ValidateString({
    description: '验证码ID',
    example: 'a1b2c3d4',
    required: true,
  })
  captchaId!: string
}
