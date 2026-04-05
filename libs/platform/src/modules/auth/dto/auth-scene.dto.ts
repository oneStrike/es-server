import {
  NestedProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { CheckVerifyCodeDto } from '@libs/platform/modules/sms/dto/sms.dto'
import { BaseAppUserDto } from '@libs/user/core'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

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
export class RefreshTokenDto extends OmitType(TokenDto, ['accessToken'] as const) {}

/**
 * 登录成功后返回的用户快照 DTO。
 * 仅保留客户端登录态初始化需要的稳定字段。
 */
export class AuthUserDto extends PickType(BaseAppUserDto, [
  'id',
  'account',
  'phoneNumber',
  'nickname',
  'avatarUrl',
  'emailAddress',
  'genderType',
  'birthDate',
  'signature',
  'bio',
  'points',
  'experience',
  'status',
  'isEnabled',
] as const) {}

/**
 * 登录入参 DTO。
 * 支持账号/手机号 + 密码，或手机号 + 短信验证码两种模式。
 */
export class LoginDto extends IntersectionType(
  PartialType(PickType(BaseAppUserDto, ['account'] as const)),
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

/**
 * 登录响应 DTO。
 */
export class LoginResponseDto {
  @NestedProperty({
    description: '令牌信息',
    type: TokenDto,
    required: true,
    validation: false,
    nullable: false,
  })
  tokens!: TokenDto

  @NestedProperty({
    description: '用户信息',
    required: true,
    type: AuthUserDto,
    validation: false,
    nullable: false,
  })
  user!: AuthUserDto
}
