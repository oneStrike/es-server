import { GenderEnum } from '@libs/platform/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto } from '@libs/platform/dto'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { IntersectionType } from '@nestjs/swagger'
import { UserGrowthSnapshotFieldsDto } from './app-user-growth-shared.dto'

/**
 * 应用用户对外基类 DTO
 * 对齐 app_user 公共输出字段，不暴露敏感信息
 */
export class BaseAppUserDto extends BaseDto {
  @StringProperty({
    description: '账号',
    example: 'user001',
    required: true,
    maxLength: 20,
  })
  account!: string

  @StringProperty({
    description: '手机号',
    example: '13800000000',
    required: false,
    maxLength: 20,
  })
  phoneNumber?: string | null

  @StringProperty({
    description: '邮箱',
    example: 'user@example.com',
    required: false,
    maxLength: 255,
  })
  emailAddress?: string | null

  @NumberProperty({
    description: '等级ID',
    example: 1,
    required: false,
  })
  levelId?: number | null

  @StringProperty({
    description: '昵称',
    example: '张三',
    required: true,
    maxLength: 100,
  })
  nickname!: string

  @StringProperty({
    description: '头像URL',
    example: 'https://example.com/avatar.png',
    required: false,
    maxLength: 500,
  })
  avatarUrl?: string | null

  @StringProperty({
    description: '个人主页背景图片URL',
    example: 'https://example.com/profile-background.png',
    required: false,
    maxLength: 500,
  })
  profileBackgroundImageUrl?: string | null

  @StringProperty({
    description: '个性签名',
    example: '持续输出，永不停歇。',
    required: false,
    maxLength: 200,
  })
  signature?: string | null

  @StringProperty({
    description: '个人简介',
    example: '一段简短的自我介绍。',
    required: false,
    maxLength: 500,
  })
  bio?: string | null

  @BooleanProperty({
    description: '是否启用',
    example: true,
    default: true,
    required: true,
  })
  isEnabled!: boolean

  @EnumProperty({
    description: '性别（0=未知；1=男性；2=女性；3=其他；4=保密）',
    enum: GenderEnum,
    example: GenderEnum.MALE,
    default: GenderEnum.UNKNOWN,
    required: true,
  })
  genderType!: GenderEnum

  @DateProperty({
    description: '出生日期',
    example: '2000-01-01',
    required: false,
  })
  birthDate?: string | Date | null

  @EnumProperty({
    description: '用户状态（1=正常；2=禁言；3=永久禁言；4=封禁；5=永久封禁）',
    enum: UserStatusEnum,
    example: UserStatusEnum.NORMAL,
    default: UserStatusEnum.NORMAL,
    required: true,
  })
  status!: UserStatusEnum

  @StringProperty({
    description: '封禁原因',
    example: '违规操作',
    required: false,
    maxLength: 500,
  })
  banReason?: string | null

  @DateProperty({
    description: '封禁到期时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  banUntil?: Date | null

  @DateProperty({
    description: '最后登录时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  lastLoginAt?: Date | null

  @StringProperty({
    description: '最后登录IP',
    example: '192.168.1.1',
    required: false,
    maxLength: 45,
  })
  lastLoginIp?: string | null

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

/**
 * 应用用户完整响应 DTO。
 * 在基础用户字段上显式组合成长余额快照，避免 `BaseAppUserDto` 与单表 schema 脱锚。
 */
export class AppUserResponseDto extends IntersectionType(
  BaseAppUserDto,
  UserGrowthSnapshotFieldsDto,
) {}
