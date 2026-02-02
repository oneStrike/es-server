import { ValidateNested, ValidateNumber, ValidateString } from '@libs/base/decorators'

export class AliyunSmsConfigDto {
  @ValidateString({
    description: '阿里云短信 Endpoint',
    example: 'dysmsapi.aliyuncs.com',
  })
  endpoint!: string

  @ValidateString({
    description: '短信签名',
    example: '阿里云',
  })
  signName!: string

  @ValidateString({
    description: '验证码模版Code',
    example: 'SMS_123456789',
  })
  verifyCodeTemplate!: string

  @ValidateNumber({
    description: '验证码过期时间（秒）',
    example: 300,
  })
  verifyCodeExpire!: number

  @ValidateNumber({
    description: '验证码长度',
    example: 6,
    default: 6,
  })
  verifyCodeLength!: number
}

export class AliyunConfigDto {
  @ValidateString({
    description: 'AccessKey ID (前端输入明文，后端加密存储)',
    example: 'LTAI...',
  })
  accessKeyId!: string

  @ValidateString({
    description: 'AccessKey Secret (前端输入明文，后端加密存储)',
    example: 'secret...',
  })
  accessKeySecret!: string

  @ValidateNested({
    description: '短信配置',
    type: AliyunSmsConfigDto,
  })
  sms!: AliyunSmsConfigDto
}
