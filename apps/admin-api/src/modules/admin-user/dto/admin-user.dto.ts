import { AdminUserRoleEnum } from '@libs/platform/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

/**
 * 管理端用户全量基类 DTO
 * 100% 对齐 admin_user 表定义
 */
export class BaseAdminUserDto extends BaseDto {
  @StringProperty({
    description: '用户名',
    example: 'admin001',
    required: true,
    maxLength: 20,
  })
  username!: string

  @StringProperty({
    description: '密码',
    example: 'Aa@123456',
    required: true,
    maxLength: 500,
    password: true,
  })
  password!: string

  @StringProperty({
    description: '手机号',
    example: '13800000000',
    required: false,
    maxLength: 11,
  })
  mobile?: string

  @StringProperty({
    description: '头像',
    example: 'https://example.com/avatar.png',
    required: false,
    maxLength: 200,
  })
  avatar?: string

  @EnumProperty({
    description: '角色 0普通管理员 1超级管理员',
    example: AdminUserRoleEnum.NORMAL_ADMIN,
    default: AdminUserRoleEnum.NORMAL_ADMIN,
    enum: AdminUserRoleEnum,
    required: true,
  })
  role!: AdminUserRoleEnum

  @BooleanProperty({
    description: '是否启用',
    example: true,
    default: true,
    required: true,
  })
  isEnabled!: boolean

  @DateProperty({
    description: '最后登录时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  lastLoginAt?: Date

  @StringProperty({
    description: '最后登录IP',
    example: '192.168.1.1',
    required: false,
    maxLength: 45,
  })
  lastLoginIp?: string
}

export class BaseUserDto extends BaseAdminUserDto {}

export class UserRegisterDto extends PickType(BaseUserDto, [
  'username',
  'mobile',
  'avatar',
  'role',
  'password',
]) {
  @StringProperty({
    description: '确认密码',
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
