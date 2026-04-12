import {
  BaseUserExperienceRecordDto,
  QueryUserExperienceRecordDto,
} from '@libs/growth/experience/dto/experience-record.dto'
import { BaseUserLevelRuleDto } from '@libs/growth/level-rule/dto/level-rule.dto'
import {
  BaseUserPointRecordDto,
  QueryUserPointRecordDto,
} from '@libs/growth/point/dto/point-record.dto'
import { BaseUserAssetsSummaryDto } from '@libs/interaction/user-assets/dto/user-assets.dto'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { UserIdDto } from '@libs/platform/dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { OmitType, PartialType, PickType } from '@nestjs/swagger'
import { BaseAppUserCountDto } from './base-app-user-count.dto'
import { BaseAppUserDto } from './base-app-user.dto'

export {
  QueryUserBadgePublicDto as QueryMyBadgeDto,
  UserBadgePublicItemDto as UserBadgeItemDto,
} from '@libs/growth/badge/dto/user-badge-management.dto'

export class QueryUserCenterDto extends PartialType(UserIdDto) {}

/**
 * app 端提及候选分页查询 DTO。
 * 仅提供轻量昵称检索，不承担完整用户搜索能力。
 */
export class QueryUserMentionPageDto extends PageDto {
  @StringProperty({
    description: '昵称关键字',
    example: '测试',
    required: false,
    maxLength: 100,
  })
  q?: string
}

/**
 * 提及候选用户 DTO。
 */
export class UserMentionCandidateDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) {}

/**
 * 更新用户资料 DTO。
 */
export class UpdateMyProfileDto extends PartialType(
  PickType(BaseAppUserDto, [
    'nickname',
    'avatarUrl',
    'emailAddress',
    'genderType',
    'birthDate',
    'signature',
    'bio',
  ] as const),
) {}

/**
 * 换绑当前用户手机号 DTO。
 */
export class ChangeMyPhoneDto {
  @StringProperty({
    description: '当前已绑定手机号',
    example: '13800138000',
    required: true,
    maxLength: 20,
  })
  currentPhone!: string

  @StringProperty({
    description: '当前已绑定手机号验证码',
    example: '123456',
    required: true,
  })
  currentCode!: string

  @StringProperty({
    description: '新的手机号',
    example: '13900139000',
    required: true,
    maxLength: 20,
  })
  newPhone!: string

  @StringProperty({
    description: '新手机号验证码',
    example: '123456',
    required: true,
  })
  newCode!: string
}

/**
 * 查询我的积分记录 DTO。
 */
export class QueryMyPointRecordDto extends OmitType(QueryUserPointRecordDto, [
  'userId',
] as const) {}

/**
 * 用户积分记录 DTO。
 */
export class UserPointRecordDto extends OmitType(BaseUserPointRecordDto, [
  'assetType',
  'delta',
  'beforeValue',
  'afterValue',
  'bizKey',
  'updatedAt',
] as const) {
  @NumberProperty({
    description: '积分变化（正数为获得，负数为消费）',
    example: 5,
    validation: false,
  })
  points!: number

  @NumberProperty({
    description: '变化前积分',
    example: 100,
    validation: false,
  })
  beforePoints!: number

  @NumberProperty({
    description: '变化后积分',
    example: 105,
    validation: false,
  })
  afterPoints!: number
}

/**
 * 查询我的经验记录 DTO。
 */
export class QueryMyExperienceRecordDto extends OmitType(
  QueryUserExperienceRecordDto,
  ['userId'] as const,
) {}

/**
 * 用户经验记录 DTO。
 */
export class UserExperienceRecordDto extends OmitType(
  BaseUserExperienceRecordDto,
  [
    'assetType',
    'delta',
    'beforeValue',
    'afterValue',
    'bizKey',
    'updatedAt',
  ] as const,
) {
  @NumberProperty({
    description: '经验值变化',
    example: 5,
    validation: false,
  })
  experience!: number

  @NumberProperty({
    description: '变化前经验值',
    example: 100,
    validation: false,
  })
  beforeExperience!: number

  @NumberProperty({
    description: '变化后经验值',
    example: 105,
    validation: false,
  })
  afterExperience!: number
}

/**
 * 用户计数 DTO。
 */
export class UserCountDto extends OmitType(BaseAppUserCountDto, [
  'userId',
  'createdAt',
  'updatedAt',
] as const) {}

/**
 * 用户状态摘要 DTO。
 */
export class UserStatusSummaryDto {
  @BooleanProperty({
    description: '账号是否可用',
    example: true,
    validation: false,
  })
  isEnabled!: boolean

  @EnumProperty({
    description: '用户状态',
    enum: UserStatusEnum,
    example: UserStatusEnum.NORMAL,
    validation: false,
  })
  status!: UserStatusEnum

  @BooleanProperty({
    description: '账号是否可以登录',
    example: true,
    validation: false,
  })
  canLogin!: boolean

  @BooleanProperty({
    description: '用户是否可以发布主题',
    example: true,
    validation: false,
  })
  canPost!: boolean

  @BooleanProperty({
    description: '用户是否可以回复',
    example: true,
    validation: false,
  })
  canReply!: boolean

  @BooleanProperty({
    description: '用户是否可以点赞',
    example: true,
    validation: false,
  })
  canLike!: boolean

  @BooleanProperty({
    description: '用户是否可以收藏',
    example: true,
    validation: false,
  })
  canFavorite!: boolean

  @BooleanProperty({
    description: '用户是否可以关注',
    example: true,
    validation: false,
  })
  canFollow!: boolean

  @StringProperty({
    description: '限制原因',
    example: '违反平台规则。',
    required: false,
    validation: false,
  })
  reason?: string

  @DateProperty({
    description: '限制到期时间',
    example: '2026-03-08T10:00:00.000Z',
    required: false,
    validation: false,
  })
  until?: Date
}

/**
 * 用户积分统计 DTO。
 */
export class UserPointStatsDto {
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

/**
 * 用户等级摘要 DTO。
 */
export class UserLevelSummaryDto extends PickType(BaseUserLevelRuleDto, [
  'id',
  'name',
  'requiredExperience',
] as const) {}

/**
 * 用户经验统计 DTO。
 */
export class UserExperienceStatsDto {
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
    type: UserLevelSummaryDto,
    required: false,
    validation: false,
    nullable: false,
  })
  level!: UserLevelSummaryDto

  @NestedProperty({
    description: '下一等级信息',
    type: UserLevelSummaryDto,
    required: false,
    validation: false,
    nullable: false,
  })
  nextLevel!: UserLevelSummaryDto

  @NumberProperty({
    description: '距离下一等级的经验值差距',
    example: 50,
    required: false,
    validation: false,
  })
  gapToNextLevel?: number
}

/**
 * 用户中心用户信息 DTO。
 */
export class UserCenterUserDto extends PickType(BaseAppUserDto, [
  'id',
  'account',
  'phoneNumber',
  'nickname',
  'avatarUrl',
  'emailAddress',
  'genderType',
  'birthDate',
] as const) {}

/**
 * 用户中心成长信息 DTO。
 */
export class UserCenterGrowthDto {
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
    description: '当前等级ID',
    example: 1,
    required: false,
    validation: false,
  })
  levelId?: number

  @StringProperty({
    description: '当前等级名称',
    example: '新手',
    required: false,
    validation: false,
  })
  levelName?: string

  @NumberProperty({
    description: '徽章数量',
    example: 3,
    validation: false,
  })
  badgeCount!: number
}

/**
 * 用户中心任务摘要 DTO。
 */
export class UserCenterTaskDto {
  @NumberProperty({
    description: '当前仍可领取的手动任务数',
    example: 2,
    validation: false,
  })
  claimableCount!: number

  @NumberProperty({
    description: '已领取待开始的任务数',
    example: 1,
    validation: false,
  })
  claimedCount!: number

  @NumberProperty({
    description: '进行中的任务数',
    example: 3,
    validation: false,
  })
  inProgressCount!: number

  @NumberProperty({
    description: '已完成但奖励待补偿的任务数',
    example: 1,
    validation: false,
  })
  rewardPendingCount!: number
}

/**
 * 用户中心资料 DTO。
 */
export class UserCenterProfileDto {
  @StringProperty({
    description: '用户签名',
    example: '持续输出，永不停歇。',
    required: false,
    validation: false,
  })
  signature?: string

  @StringProperty({
    description: '用户简介',
    example: '一段简短的自我介绍。',
    required: false,
    validation: false,
  })
  bio?: string

  @EnumProperty({
    description: '用户状态',
    enum: UserStatusEnum,
    example: UserStatusEnum.NORMAL,
    validation: false,
  })
  status!: UserStatusEnum

  @StringProperty({
    description: '限制原因',
    example: '违反平台规则。',
    required: false,
    validation: false,
  })
  banReason?: string

  @DateProperty({
    description: '限制到期时间',
    example: '2026-03-08T10:00:00.000Z',
    required: false,
    validation: false,
  })
  banUntil?: Date

  @NestedProperty({
    description: '用户计数',
    type: UserCountDto,
    validation: false,
    nullable: false,
  })
  counts!: UserCountDto
}

/**
 * 用户中心消息摘要 DTO。
 */
export class UserCenterMessageDto {
  @NumberProperty({
    description: '未读通知数量',
    example: 3,
    validation: false,
  })
  notificationUnreadCount!: number

  @NumberProperty({
    description: '收件箱未读消息总数',
    example: 5,
    validation: false,
  })
  totalUnreadCount!: number
}

/**
 * 用户中心汇总 DTO。
 */
export class UserCenterDto {
  @NestedProperty({
    description: '用户基本信息',
    type: UserCenterUserDto,
    validation: false,
    nullable: false,
  })
  user!: UserCenterUserDto

  @NestedProperty({
    description: '成长信息',
    type: UserCenterGrowthDto,
    validation: false,
    nullable: false,
  })
  growth!: UserCenterGrowthDto

  @NestedProperty({
    description: '用户资料',
    type: UserCenterProfileDto,
    validation: false,
    nullable: false,
  })
  profile!: UserCenterProfileDto

  @NestedProperty({
    description: '资产统计',
    type: BaseUserAssetsSummaryDto,
    validation: false,
    nullable: false,
  })
  assets!: BaseUserAssetsSummaryDto

  @NestedProperty({
    description: '消息统计',
    type: UserCenterMessageDto,
    validation: false,
    nullable: false,
  })
  message!: UserCenterMessageDto

  @NestedProperty({
    description: '任务摘要',
    type: UserCenterTaskDto,
    validation: false,
    nullable: false,
  })
  task!: UserCenterTaskDto
}
