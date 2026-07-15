import { StringProperty } from '@libs/platform/decorators'
import { CheckVerifyCodeDto } from '@libs/platform/modules/sms/dto'
import { IntersectionType, OmitType, PartialType } from '@nestjs/swagger'

/**
 * RSA 公钥信息 DTO。
 */
export class RsaPublicKeyDto {
  @StringProperty({
    description: 'RSA公钥',
    example:
      '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhki.......GIf8OQIDAQAB\n-----END PUBLIC KEY-----',
    validation: false,
  })
  publicKey!: string
}

/**
 * 登录态令牌对 DTO。
 */
export class TokenDto {
  @StringProperty({
    description: '账号令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
  })
  accessToken!: string

  @StringProperty({
    description: '刷新令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
  })
  refreshToken!: string
}

/**
 * 刷新令牌入参 DTO。
 */
export class RefreshTokenDto extends OmitType(TokenDto, [
  'accessToken',
] as const) {}

/** 平台认证只拥有登录标识，不依赖具体用户域 DTO。 */
class LoginAccountDto {
  @StringProperty({ description: '账号', example: 'user001', required: false })
  account?: string
}

/**
 * 登录入参 DTO。
 * 支持账号/手机号 + 密码，或手机号 + 短信验证码两种模式。
 */
export class LoginDto extends IntersectionType(
  PartialType(LoginAccountDto),
  PartialType(CheckVerifyCodeDto),
) {
  @StringProperty({
    description: '密码',
    example: 'Aa@123456',
    required: false,
  })
  password?: string
}

/**
 * 找回密码入参 DTO。
 */
export class ForgotPasswordDto extends CheckVerifyCodeDto {
  @StringProperty({
    description: '密码',
    example: 'Aa@123456',
    required: true,
  })
  password!: string
}

/**
 * 修改密码入参 DTO。
 */
export class ChangePasswordDto {
  @StringProperty({
    description: '旧密码',
    example: 'Aa@123456',
    required: true,
  })
  oldPassword!: string

  @StringProperty({
    description: '新密码',
    example: 'Aa@123456',
    required: true,
  })
  newPassword!: string

  @StringProperty({
    description: '确认新密码',
    example: 'Aa@123456',
    required: true,
  })
  confirmNewPassword!: string
}
