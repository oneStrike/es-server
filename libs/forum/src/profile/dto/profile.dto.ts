import { GenderEnum, UserStatusEnum } from '@libs/base/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 基础用户个人信息数据传输对象
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
    example: '2023-09-15T00:00:00.000Z',
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
}

/**
 * 基础用户资料数据传输对象
 * 包含用户ID、积分数量、等级ID、签名、个人简介、用户状态、封禁原因、封禁结束时间等字段
 */
export class BaseForumProfileDto extends BaseDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '积分数量',
    example: 100,
    required: true,
  })
  points!: number

  @NumberProperty({
    description: '等级ID',
    example: 100,
    required: true,
  })
  levelId!: number

  @StringProperty({
    description: '签名',
    example: '这是我的签名',
    required: true,
    maxLength: 200,
  })
  signature!: string

  @StringProperty({
    description: '个人简介',
    example: '这是我的个人简介',
    required: true,
    maxLength: 500,
  })
  bio!: string

  @EnumProperty({
    description: '用户状态',
    example: UserStatusEnum.NORMAL,
    enum: UserStatusEnum,
    required: true,
  })
  status!: UserStatusEnum

  @StringProperty({
    description: '封禁原因',
    example: '违反社区规则',
    required: true,
    maxLength: 200,
  })
  banReason!: string

  @DateProperty({
    description: '封禁结束时间',
    example: '2023-09-15T00:00:00.000Z',
    required: true,
  })
  banUntil!: Date

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

/**
 * 查询用户资料列表DTO
 */
export class QueryForumProfileListDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumProfileDto, ['levelId', 'status'])),
) {
  @StringProperty({
    description: '昵称',
    example: '张三',
    required: false,
    maxLength: 50,
  })
  nickname?: string
}

/**
 * 更新用户资料状态DTO
 */
export class UpdateForumProfileStatusDto extends PickType(BaseForumProfileDto, [
  'userId',
  'status',
  'banReason',
]) {}

/**
 * 授予徽章DTO
 * 用于为用户授予徽章
 */
export class GrantForumBadgeDto extends PickType(BaseForumProfileDto, [
  'userId',
]) {
  @NumberProperty({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  badgeId!: number
}

/**
 * 撤销徽章DTO
 */
export class RevokeForumBadgeDto extends GrantForumBadgeDto {}
