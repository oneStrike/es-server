import { GenderEnum } from '@libs/base/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto } from '@libs/base/dto'
import { CheckVerifyCodeDto } from '@libs/base/modules'
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
 * 基础用户信息
 */
export class BaseAppUserDto extends BaseDto {
  @StringProperty({
    description: '账号（唯一）',
    example: '123456',
    required: true,
    maxLength: 11,
    minLength: 6,
  })
  account!: string

  @StringProperty({
    description: '手机号码',
    example: '13800000000',
    required: true,
    maxLength: 11,
  })
  phone!: string

  @StringProperty({
    description: '用户昵称（显示名称）',
    example: '张三',
    required: true,
    maxLength: 100,
  })
  nickname!: string

  @StringProperty({
    description: '头像URL地址',
    example: 'https://example.com/avatar.jpg',
    required: false,
    maxLength: 500,
  })
  avatar?: string

  @StringProperty({
    description: '邮箱地址',
    example: 'user@example.com',
    required: false,
    maxLength: 255,
  })
  email?: string

  @BooleanProperty({
    description: '账户状态（true:启用, false:禁用）',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @EnumProperty({
    description: '性别',
    example: GenderEnum.MALE,
    enum: GenderEnum,
    required: true,
  })
  gender!: GenderEnum

  @DateProperty({
    description: '出生日期',
    example: '2023-09-15T00:00:00.000Z',
    required: false,
    validation: false,
  })
  birthDate?: Date

  @DateProperty({
    description: '最后登录时间',
    default: null,
    example: '2023-09-15T00:00:00.000Z',
    validation: false,
  })
  lastLoginAt?: Date

  @StringProperty({
    description: '最后登录IP',
    default: null,
    example: '192.168.1.1',
    validation: false,
  })
  lastLoginIp?: string

  @NumberProperty({
    description: '积分',
    default: 0,
    example: 100,
    validation: false,
  })
  points!: number

  @NumberProperty({
    description: '经验值',
    default: 0,
    example: 1000,
    validation: false,
  })
  experience!: number

  @NumberProperty({
    description: '等级ID',
    default: null,
    example: 1,
    validation: false,
  })
  levelId?: number

  @NumberProperty({
    description: '状态',
    default: 1,
    example: 1,
    validation: false,
  })
  status!: number

  @StringProperty({
    description: '账号封禁原因',
    default: '',
    example: '账户已被封禁',
    required: false,
    validation: false,
  })
  banReason?: string

  @DateProperty({
    description: '账号封禁截止时间',
    default: null,
    example: '2023-09-15T00:00:00.000Z',
    required: false,
    validation: false,
  })
  banUntil?: Date
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
  tokens: TokenDto

  @NestedProperty({
    description: '用户信息',
    required: true,
    type: BaseAppUserDto,
    validation: false,
  })
  user: BaseAppUserDto
}
