import { ValidateString } from '@libs/decorators'
import { ApiProperty, OmitType } from '@nestjs/swagger'
import { BaseUserDto } from '../../user/dto/user.dto'

/**
 * RSA公钥响应DTO
 */
export class RsaPublicKeyDto {
  @ApiProperty({
    description: 'RSA公钥',
    example:
      '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhki.......GIf8OQIDAQAB\n-----END PUBLIC KEY-----',
  })
  publicKey!: string
}

export class TokenDto {
  @ValidateString({
    description: '账号令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
  })
  accessToken!: string

  @ValidateString({
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
export class UserLoginDto {
  @ValidateString({
    description: '用户名',
    example: 'admin001',
    required: true,
    maxLength: 20,
    minLength: 5,
  })
  username!: string

  @ValidateString({
    description: '密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  password!: string

  @ValidateString({
    description: '验证码',
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

/**
 * 登录响应 DTO
 */
export class LoginResponseDto {
  @ApiProperty({
    description: '令牌信息',
    type: TokenDto,
    required: true,
  })
  tokens: TokenDto

  @ApiProperty({
    description: '用户信息',
    required: true,
    type: BaseUserDto,
  })
  user: BaseUserDto
}
