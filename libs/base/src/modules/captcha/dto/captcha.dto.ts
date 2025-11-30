import { ValidateString } from '@libs/base/decorators'

export class CaptchaDto {
  @ValidateString({
    description: '验证码',
    example: '1234',
    required: true,
    maxLength: 4,
    minLength: 4,
  })
  captcha!: string

  @ValidateString({
    description: '验证码ID',
    example: 'a1b2c3d4',
    required: true,
  })
  captchaId!: string
}
