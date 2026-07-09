import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger'
import { AdminRoleSummaryDto } from './admin-rbac.dto'

/**
 * 管理端用户基础 DTO。
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

/**
 * 管理员账号输出 DTO。
 */
export class AdminUserResponseDto extends OmitType(BaseAdminUserDto, [
  'password',
  'mobile',
  'avatar',
  'lastLoginAt',
  'lastLoginIp',
] as const) {
  @StringProperty({
    description: '手机号',
    example: '13800000000',
    required: true,
    nullable: true,
    validation: false,
  })
  mobile!: string | null

  @StringProperty({
    description: '头像',
    example: 'https://example.com/avatar.png',
    required: true,
    nullable: true,
    validation: false,
  })
  avatar!: string | null

  @DateProperty({
    description: '最后登录时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    nullable: true,
    validation: false,
  })
  lastLoginAt!: Date | null

  @StringProperty({
    description: '最后登录IP',
    example: '192.168.1.1',
    required: true,
    nullable: true,
    validation: false,
  })
  lastLoginIp!: string | null

  @ArrayProperty({
    description: '角色id集合',
    itemType: 'number',
    example: [1],
    required: true,
    validation: false,
  })
  roleIds!: number[]

  @ArrayProperty({
    description: '角色列表',
    itemClass: AdminRoleSummaryDto,
    required: true,
    validation: false,
  })
  roles!: AdminRoleSummaryDto[]

  @ArrayProperty({
    description: '权限编码列表',
    itemType: 'string',
    example: ['system:user:create'],
    required: true,
    validation: false,
  })
  accessCodes!: string[]

  @BooleanProperty({
    description: '是否超级管理员',
    example: true,
    required: true,
    validation: false,
  })
  isSuperAdmin!: boolean
}

/**
 * 管理员密码重置结果 DTO。
 */
export class ResetAdminUserPasswordResultDto {
  @StringProperty({
    description: '一次性临时密码，仅本次响应返回',
    example: 'Aa1!TempGenerated',
    required: true,
    password: true,
  })
  temporaryPassword!: string
}

/**
 * 创建管理员账号 DTO。
 */
export class UserRegisterDto extends PickType(BaseAdminUserDto, [
  'username',
  'mobile',
  'avatar',
  'password',
] as const) {
  @StringProperty({
    description: '确认密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  confirmPassword!: string

  @ArrayProperty({
    description: '角色id集合',
    itemType: 'number',
    example: [1],
    required: true,
  })
  roleIds!: number[]
}

/**
 * 更新管理员账号 DTO。
 */
export class UpdateUserDto extends PickType(BaseAdminUserDto, [
  'id',
  'username',
  'avatar',
  'mobile',
  'isEnabled',
] as const) {
  @ArrayProperty({
    description: '角色id集合',
    itemType: 'number',
    example: [1],
    required: true,
  })
  roleIds!: number[]
}

/**
 * 管理员账号分页查询 DTO。
 */
export class UserPageDto extends IntersectionType(
  PartialType(PickType(BaseAdminUserDto, ['username', 'mobile', 'isEnabled'] as const)),
  PageDto,
) {
  @NumberProperty({
    description: '角色id',
    example: 1,
    required: false,
  })
  roleId?: number
}

/**
 * 管理员账号修改密码 DTO。
 */
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
