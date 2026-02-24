import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { UserRoleEnum } from '../user.constant'

export class BaseUserDto extends BaseDto {
  @StringProperty({
    description: '用户名',
    example: 'admin001',
    required: true,
    maxLength: 20,
    minLength: 5,
  })
  username!: string

  @StringProperty({
    description: '手机号',
    example: '13838384388',
    required: false,
  })
  mobile?: string

  @StringProperty({
    description: '头像',
    example: 'https://example.com/avatar.png',
    required: false,
  })
  avatar?: string

  @BooleanProperty({
    description: '是否启用',
    example: true,
    default: true,
  })
  isEnabled?: boolean

  @EnumProperty({
    description: '角色 0普通管理员 1超级管理员',
    example: 0,
    default: 0,
    enum: UserRoleEnum,
  })
  role: UserRoleEnum

  @DateProperty({
    description: '最后登录时间',
    example: '2021-01-01 00:00:00',
    required: false,
  })
  lastLoginAt?: Date

  @StringProperty({
    description: '最后登录IP',
    example: '192.168.1.1',
    required: false,
  })
  lastLoginIp?: string
}

export class UserRegisterDto extends PickType(BaseUserDto, [
  'username',
  'mobile',
  'avatar',
  'role',
]) {
  @StringProperty({
    description: '手机号',
    example: '13838384388',
    required: true,
  })
  mobile!: string

  @StringProperty({
    description: '密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  password!: string

  @StringProperty({
    description: '密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  confirmPassword!: string
}

export class UpdateUserDto extends PickType(BaseUserDto, [
  'id',
  'username',
  'avatar',
  'mobile',
  'isEnabled',
  'role',
]) {}

export class UserPageDto extends IntersectionType(
  PartialType(
    PickType(BaseUserDto, ['username', 'mobile', 'isEnabled', 'role']),
  ),
  PageDto,
) {}

export class ChangePasswordDto {
  @StringProperty({
    description: '旧密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  oldPassword!: string

  @StringProperty({
    description: '新密码',
    example: 'Aa@654321',
    required: true,
    password: true,
  })
  newPassword!: string

  @StringProperty({
    description: '确认新密码',
    example: 'Aa@654321',
    required: true,
    password: true,
  })
  confirmPassword!: string
}
