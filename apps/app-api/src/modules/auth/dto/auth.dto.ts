import { ValidateBoolean, ValidateEnum, ValidateString } from '@libs/base/decorators'
import { BaseDto } from '@libs/base/dto'
import { GenderEnum } from '@libs/base/enum'
import { ApiProperty, OmitType } from '@nestjs/swagger'

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

export class RegisterDto {
  @ValidateString({
    description: '登录账号',
    example: 'user123',
    required: true,
    maxLength: 50,
  })
  account!: string

  @ValidateString({
    description: '用户昵称',
    example: '张三',
    required: true,
    maxLength: 100,
  })
  nickname!: string

  @ValidateString({
    description: '密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  password!: string

  @ValidateString({
    description: '手机号码',
    example: '13800000000',
    required: false,
    maxLength: 11,
  })
  phone?: string

  @ValidateString({
    description: '邮箱地址',
    example: 'user@example.com',
    required: false,
    maxLength: 255,
  })
  email?: string

  @ValidateEnum({
    description: '性别',
    example: GenderEnum.MALE,
    enum: GenderEnum,
    required: true,
  })
  gender!: GenderEnum
}

export class LoginDto {
  @ValidateString({
    description: '登录账号',
    example: 'user123',
    required: true,
    maxLength: 50,
  })
  account!: string

  @ValidateString({
    description: '密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  password!: string
}

export class ForgotPasswordDto {
  @ValidateString({
    description: '账号（支持账号、手机号、邮箱）',
    example: 'user123',
    required: true,
  })
  account!: string
}

export class ResetPasswordDto {
  @ValidateString({
    description: '账号（支持账号、手机号、邮箱）',
    example: 'user123',
    required: true,
  })
  account!: string

  @ValidateString({
    description: '新密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  password!: string
}

export class ForgotPasswordResponseDto {
  @ApiProperty({
    description: '提示信息',
    example: '如果账号存在，重置密码的验证码已发送',
  })
  message!: string
}

export class BaseAppUserDto extends BaseDto {
  @ValidateString({
    description: '用户名（登录账号）',
    example: 'user123',
    required: true,
    maxLength: 50,
  })
  account!: string

  @ValidateString({
    description: '用户昵称（显示名称）',
    example: '张三',
    required: true,
    maxLength: 100,
  })
  nickname!: string

  @ValidateString({
    description: '头像URL地址',
    example: 'https://example.com/avatar.jpg',
    required: false,
    maxLength: 500,
  })
  avatar?: string

  @ValidateString({
    description: '手机号码',
    example: '13800000000',
    required: false,
    maxLength: 11,
  })
  phone?: string

  @ValidateString({
    description: '邮箱地址',
    example: 'user@example.com',
    required: false,
    maxLength: 255,
  })
  email?: string

  @ValidateBoolean({
    description: '账户状态（true:启用, false:禁用）',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @ValidateEnum({
    description: '性别',
    example: GenderEnum.MALE,
    enum: GenderEnum,
    required: true,
  })
  gender!: GenderEnum

  @ApiProperty({
    description: '出生日期',
    example: '2023-09-15T00:00:00.000Z',
    required: false,
  })
  birthDate?: Date

  @ApiProperty({
    description: '是否签到',
    default: false,
    example: true,
  })
  isSignedIn!: boolean

  @ApiProperty({
    description: '最后登录时间',
    default: null,
    example: '2023-09-15T00:00:00.000Z',
  })
  lastLoginAt?: Date

  @ApiProperty({
    description: '最后登录IP',
    default: null,
    example: '192.168.1.1',
  })
  lastLoginIp?: string
}

export class RegisterResponseDto {
  @ApiProperty({
    description: '令牌信息',
    type: TokenDto,
    required: true,
  })
  tokens: TokenDto

  @ApiProperty({
    description: '用户信息',
    required: true,
    type: BaseAppUserDto,
  })
  user: BaseAppUserDto
}

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
    type: BaseAppUserDto,
  })
  user: BaseAppUserDto
}
