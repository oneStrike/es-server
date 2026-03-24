import {
  NestedProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { CheckVerifyCodeDto } from '@libs/platform/modules'
import { BaseAppUserDto } from '@libs/user/core'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * RSA公钥信息
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
 * jwt令牌信息
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
 * 刷新令牌信息
 */
export class RefreshTokenDto extends OmitType(TokenDto, ['accessToken']) { }

/**
 * 登录请求信息
 */
export class LoginDto extends IntersectionType(
  PartialType(PickType(BaseAppUserDto, ['account'])),
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
 * 忘记密码请求信息
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
 * 修改密码请求信息
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
 * 登录响应信息
 */
export class LoginResponseDto {
  @NestedProperty({
    description: '令牌信息',
    type: TokenDto,
    required: true,
    validation: false,
  })
  tokens!: TokenDto

  @NestedProperty({
    description: '用户信息',
    required: true,
    type: BaseAppUserDto,
    validation: false,
  })
  user!: BaseAppUserDto
}
