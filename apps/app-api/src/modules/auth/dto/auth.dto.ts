import { ValidateBoolean, ValidateEnum, ValidateNumber, ValidateString } from '@libs/base/decorators'
import { BaseDto } from '@libs/base/dto'
import { GenderEnum } from '@libs/base/enum'
import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger'

/**
 * RSA公钥信息
 */
export class RsaPublicKeyDto {
  @ApiProperty({
    description: 'RSA公钥',
    example:
      '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhki.......GIf8OQIDAQAB\n-----END PUBLIC KEY-----',
  })
  publicKey!: string
}

/**
 * 基础用户信息
 */
export class BaseAppUserDto extends BaseDto {
  @ValidateNumber({
    description: '账号（唯一）',
    example: 123456,
    required: true,
    max: 999999999,
    min: 100000,
  })
  account!: number

  @ValidateString({
    description: '手机号码',
    example: '13800000000',
    required: true,
    maxLength: 11,
  })
  phone!: string

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

/**
 * jwt令牌信息
 */
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

/**
 * 刷新令牌信息
 */
export class RefreshTokenDto extends OmitType(TokenDto, ['accessToken']) { }

/**
 * 登录请求信息
 */
export class LoginDto extends PartialType(PickType(BaseAppUserDto, ['phone', 'account'])) {
  @ValidateString({
    description: '密码',
    example: 'Aa@123456',
    required: false,
    password: true,
  })
  password?: string

  @ValidateString({
    description: '验证码',
    example: '330049',
    required: false,
  })
  code?: string
}

/**
 * 忘记密码请求信息
 */
export class ForgotPasswordDto {
  @ValidateString({
    description: '手机号',
    example: '13800000000',
    required: true,
    maxLength: 11,
  })
  phone!: string

  @ValidateString({
    description: '密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  password!: string

  @ValidateNumber({
    description: '手机号验证码',
    example: 330049,
    required: true,
  })
  code!: number
}

/**
 * 重置密码请求信息
 */
export class ResetPasswordDto {
  @ValidateString({
    description: '旧密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  oldPassword!: string

  @ValidateString({
    description: '新密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  newPassword!: string

  @ValidateString({
    description: '确认新密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  confirmNewPassword!: string
}

/**
 * 登录响应信息
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
    type: BaseAppUserDto,
  })
  user: BaseAppUserDto
}
