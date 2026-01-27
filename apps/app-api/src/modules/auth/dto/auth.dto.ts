import {
  ValidateBoolean,
  ValidateEnum,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto } from '@libs/base/dto'
import { GenderEnum } from '@libs/base/enum'
import { CheckVerifyCodeDto } from '@libs/base/modules'
import {
  ApiProperty,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

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
  @ValidateString({
    description: '账号（唯一）',
    example: '123456',
    required: true,
    maxLength: 11,
    minLength: 6,
  })
  account!: string

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

  @ApiProperty({
    description: '积分',
    default: 0,
    example: 100,
  })
  points!: number

  @ApiProperty({
    description: '经验值',
    default: 0,
    example: 1000,
  })
  experience!: number

  @ApiProperty({
    description: '等级ID',
    default: null,
    example: 1,
  })
  levelId?: number

  @ApiProperty({
    description: '状态',
    default: 1,
    example: 1,
  })
  status!: number

  @ApiProperty({
    description: '账号封禁原因',
    default: '',
    example: '账户已被封禁',
    required: false,
    nullable: true,
  })
  banReason?: string

  @ApiProperty({
    description: '账号封禁截止时间',
    default: null,
    example: '2023-09-15T00:00:00.000Z',
    required: false,
    nullable: true,
  })
  banUntil?: Date
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
export class RefreshTokenDto extends OmitType(TokenDto, ['accessToken']) {}

/**
 * 登录请求信息
 */
export class LoginDto extends IntersectionType(
  PartialType(PickType(BaseAppUserDto, ['account'])),
  PartialType(CheckVerifyCodeDto),
) {
  @ValidateString({
    description: '密码',
    example: 'Aa@123456',
    required: false,
    password: true,
  })
  password?: string
}

/**
 * 忘记密码请求信息
 */
export class ForgotPasswordDto extends CheckVerifyCodeDto {
  @ValidateString({
    description: '密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  password!: string
}

/**
 * 修改密码请求信息
 */
export class ChangePasswordDto {
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
