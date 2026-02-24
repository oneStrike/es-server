import { NestedProperty, StringProperty } from '@libs/base/decorators'
import { CaptchaDto } from '@libs/base/modules'
import { OmitType } from '@nestjs/swagger'
import { BaseUserDto } from '../../user/dto/user.dto'

/**
 * RSA公钥响应DTO
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

export class RefreshTokenDto extends OmitType(TokenDto, ['accessToken']) {}

/**
 * 用户登录 DTO
 */
export class UserLoginDto extends CaptchaDto {
  @StringProperty({
    description: '用户名',
    example: 'admin001',
    required: true,
    maxLength: 20,
    minLength: 5,
  })
  username!: string

  @StringProperty({
    description: '密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  password!: string
}

/**
 * 登录响应 DTO
 */
export class LoginResponseDto {
  @NestedProperty({
    description: '令牌信息',
    type: TokenDto,
    required: true,
    validation: false,
  })
  tokens: TokenDto

  @NestedProperty({
    description: '用户信息',
    required: true,
    type: BaseUserDto,
    validation: false,
  })
  user: BaseUserDto
}
