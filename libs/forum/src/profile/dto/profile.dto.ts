import { GenderEnum } from '@libs/platform/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'

/**
 * 基础用户个人信息 DTO。
 * 作为论坛场景下复用的 app_user 简要基类。
 */
export class BaseAppUserInfoDto extends BaseDto {
  @StringProperty({
    description: '用户名（登录账号）',
    example: 'user123',
    required: true,
    maxLength: 50,
  })
  account!: string

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
    description: '手机号码',
    example: '13800000000',
    required: false,
    maxLength: 11,
  })
  phone?: string

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
  genderType!: GenderEnum

  @DateProperty({
    description: '出生日期',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  birthDate?: Date

  @BooleanProperty({
    description: '是否签到',
    default: false,
    example: true,
    validation: false,
  })
  isSignedIn!: boolean

  @DateProperty({
    description: '最后登录时间',
    default: null,
    example: '2024-01-01T00:00:00.000Z',
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
}

/**
 * 论坛用户画像基础 DTO。
 * 严格对应 forum_profile 表字段。
 */
export class BaseForumProfileDto extends BaseDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @StringProperty({
    description: '签名',
    example: '这是我的签名',
    required: false,
    maxLength: 200,
  })
  signature?: string

  @StringProperty({
    description: '个人简介',
    example: '这是我的个人简介',
    required: false,
    maxLength: 500,
  })
  bio?: string

  @NumberProperty({
    description: '主题数',
    default: 0,
    example: 10,
    validation: false,
  })
  topicCount!: number

  @NumberProperty({
    description: '回复数',
    default: 0,
    example: 100,
    validation: false,
  })
  replyCount!: number

  @NumberProperty({
    description: '点赞数',
    default: 0,
    example: 5,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '收藏数',
    default: 0,
    example: 5,
    validation: false,
  })
  favoriteCount!: number
}
