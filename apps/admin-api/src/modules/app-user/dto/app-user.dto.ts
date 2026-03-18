import { AddUserExperienceDto, AddUserPointsDto, BaseUserBadgeDto, ConsumeUserPointsDto, QueryUserBadgeDto, QueryUserExperienceRecordDto, QueryUserPointRecordDto } from '@libs/growth'
import { GenderEnum, UserStatusEnum } from '@libs/platform/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto } from '@libs/platform/dto'

import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class BaseAdminAppUserDto extends BaseDto {
  @StringProperty({
    description: '应用端账号',
    example: '123456',
    required: true,
    maxLength: 20,
    minLength: 6,
  })
  account!: string

  @StringProperty({
    description: '手机号',
    example: '13800000000',
    required: false,
    maxLength: 20,
  })
  phone?: string

  @StringProperty({
    description: '昵称',
    example: '张三',
    required: true,
    maxLength: 100,
  })
  nickname!: string

  @StringProperty({
    description: '头像地址',
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
    description: '是否启用账号',
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
    example: '2026-03-08T00:00:00.000Z',
    required: false,
    validation: false,
  })
  birthDate?: Date

  @NumberProperty({
    description: '当前积分',
    example: 120,
    validation: false,
  })
  points!: number

  @NumberProperty({
    description: '当前经验值',
    example: 350,
    validation: false,
  })
  experience!: number

  @NumberProperty({
    description: '等级ID',
    example: 1,
    required: false,
    validation: false,
  })
  levelId?: number

  @EnumProperty({
    description: '社区状态',
    example: UserStatusEnum.NORMAL,
    enum: UserStatusEnum,
    validation: false,
  })
  status!: UserStatusEnum

  @StringProperty({
    description: '封禁或禁言原因',
    example: '违反社区规范',
    required: false,
    validation: false,
  })
  banReason?: string

  @DateProperty({
    description: '封禁或禁言截止时间',
    example: '2026-03-08T10:00:00.000Z',
    required: false,
    validation: false,
  })
  banUntil?: Date

  @DateProperty({
    description: '最后登录时间',
    example: '2026-03-08T10:00:00.000Z',
    required: false,
    validation: false,
  })
  lastLoginAt?: Date

  @StringProperty({
    description: '最后登录IP',
    example: '192.168.1.1',
    required: false,
    validation: false,
  })
  lastLoginIp?: string
}

export class AdminAppUserLevelDto {
  @NumberProperty({
    description: '等级ID',
    example: 1,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '等级名称',
    example: '新手',
    validation: false,
  })
  name!: string

  @NumberProperty({
    description: '升级所需经验值',
    example: 100,
    validation: false,
  })
  requiredExperience!: number
}

export class AdminAppUserForumProfileDto {
  @StringProperty({
    description: '论坛签名',
    example: '持续交付，持续迭代',
    required: false,
    validation: false,
  })
  signature?: string

  @StringProperty({
    description: '论坛简介',
    example: '一个简单的自我介绍',
    required: false,
    validation: false,
  })
  bio?: string

  @NumberProperty({
    description: '主题数',
    example: 12,
    validation: false,
  })
  topicCount!: number

  @NumberProperty({
    description: '回复数',
    example: 48,
    validation: false,
  })
  replyCount!: number

  @NumberProperty({
    description: '获赞数',
    example: 66,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '获收藏数',
    example: 9,
    validation: false,
  })
  favoriteCount!: number
}

export class AdminAppUserPointStatsDto {
  @NumberProperty({
    description: '当前积分',
    example: 120,
    validation: false,
  })
  currentPoints!: number

  @NumberProperty({
    description: '今日获得积分',
    example: 15,
    validation: false,
  })
  todayEarned!: number

  @NumberProperty({
    description: '今日消耗积分',
    example: 5,
    validation: false,
  })
  todayConsumed!: number
}

export class AdminAppUserExperienceStatsDto {
  @NumberProperty({
    description: '当前经验值',
    example: 350,
    validation: false,
  })
  currentExperience!: number

  @NumberProperty({
    description: '今日获得经验值',
    example: 20,
    validation: false,
  })
  todayEarned!: number

  @NestedProperty({
    description: '当前等级信息',
    type: AdminAppUserLevelDto,
    required: false,
    validation: false,
  })
  level?: AdminAppUserLevelDto

  @NestedProperty({
    description: '下一等级信息',
    type: AdminAppUserLevelDto,
    required: false,
    validation: false,
  })
  nextLevel?: AdminAppUserLevelDto

  @NumberProperty({
    description: '距离下一等级的经验差值',
    example: 50,
    required: false,
    validation: false,
  })
  gapToNextLevel?: number
}

export class AdminAppUserPageItemDto extends BaseAdminAppUserDto {
  @StringProperty({
    description: '等级名称',
    example: '新手',
    required: false,
    validation: false,
  })
  levelName?: string

  @NumberProperty({
    description: '主题数',
    example: 12,
    validation: false,
  })
  topicCount!: number

  @NumberProperty({
    description: '回复数',
    example: 48,
    validation: false,
  })
  replyCount!: number
}

export class AdminAppUserDetailDto extends BaseAdminAppUserDto {
  @NestedProperty({
    description: '等级信息',
    type: AdminAppUserLevelDto,
    required: false,
    validation: false,
  })
  level?: AdminAppUserLevelDto

  @NestedProperty({
    description: '论坛画像信息',
    type: AdminAppUserForumProfileDto,
    required: false,
    validation: false,
  })
  forumProfile?: AdminAppUserForumProfileDto

  @NumberProperty({
    description: '已拥有徽章数量',
    example: 3,
    validation: false,
  })
  badgeCount!: number

  @NestedProperty({
    description: '积分统计',
    type: AdminAppUserPointStatsDto,
    validation: false,
  })
  pointStats!: AdminAppUserPointStatsDto

  @NestedProperty({
    description: '经验统计',
    type: AdminAppUserExperienceStatsDto,
    validation: false,
  })
  experienceStats!: AdminAppUserExperienceStatsDto
}

export class QueryAdminAppUserPageDto extends IntersectionType(
  PartialType(
    PickType(BaseAdminAppUserDto, [
      'id',
      'account',
      'phone',
      'nickname',
      'email',
      'isEnabled',
      'status',
      'levelId',
    ] as const),
  ),
  PageDto,
) {
  @StringProperty({
    description: '最后登录开始时间',
    example: '2026-03-01',
    required: false,
    type: 'ISO8601',
  })
  lastLoginStartDate?: string

  @StringProperty({
    description: '最后登录结束时间',
    example: '2026-03-08',
    required: false,
    type: 'ISO8601',
  })
  lastLoginEndDate?: string
}

export class QueryAdminAppUserIdDto {
  @NumberProperty({
    description: '应用端用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class UpdateAdminAppUserProfileDto extends IntersectionType(
  PickType(BaseAdminAppUserDto, ['id'] as const),
  PartialType(
    PickType(BaseAdminAppUserDto, [
      'nickname',
      'avatar',
      'phone',
      'email',
      'gender',
      'birthDate',
    ] as const),
  ),
) {
  @StringProperty({
    description: '论坛签名',
    example: '持续交付，持续迭代',
    required: false,
    maxLength: 200,
  })
  signature?: string

  @StringProperty({
    description: '论坛简介',
    example: '一个简单的自我介绍',
    required: false,
    maxLength: 500,
  })
  bio?: string
}

export class UpdateAdminAppUserEnabledDto extends PickType(BaseAdminAppUserDto, [
  'id',
  'isEnabled',
] as const) {}

export class UpdateAdminAppUserStatusDto extends PickType(BaseAdminAppUserDto, [
  'id',
  'status',
] as const) {
  @StringProperty({
    description: '封禁或禁言原因',
    example: '违反社区规范',
    required: false,
    maxLength: 500,
  })
  banReason?: string

  @DateProperty({
    description: '封禁或禁言截止时间',
    example: '2026-03-08T10:00:00.000Z',
    required: false,
  })
  banUntil?: Date
}

export class QueryAdminAppUserPointRecordDto extends QueryUserPointRecordDto {}

export class QueryAdminAppUserExperienceRecordDto extends QueryUserExperienceRecordDto {}

export class QueryAdminAppUserBadgeDto extends QueryUserBadgeDto {
  @NumberProperty({
    description: '应用端用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class AddAdminAppUserPointsDto extends AddUserPointsDto {}

export class ConsumeAdminAppUserPointsDto extends ConsumeUserPointsDto {}

export class AddAdminAppUserExperienceDto extends AddUserExperienceDto {}

export class AssignAdminAppUserBadgeDto {
  @NumberProperty({
    description: '应用端用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  badgeId!: number
}

export class AdminAppUserBadgeItemDto extends PickType(BaseDto, ['id', 'createdAt']) {
  @NestedProperty({
    description: '徽章信息',
    type: BaseUserBadgeDto,
    validation: false,
  })
  badge!: BaseUserBadgeDto
}

export class AdminAppUserBadgeOperationResultDto {
  @NumberProperty({
    description: '应用端用户ID',
    example: 1,
    validation: false,
  })
  userId!: number

  @NumberProperty({
    description: '徽章ID',
    example: 1,
    validation: false,
  })
  badgeId!: number
}
