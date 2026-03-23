import { BaseUserBadgeDto } from '@libs/growth/badge'
import { BaseUserExperienceRecordDto } from '@libs/growth/experience'
import { BaseUserLevelRuleDto } from '@libs/growth/level-rule'
import { BaseUserAssetsSummaryDto } from '@libs/interaction/user-assets'
import { UserStatusEnum } from '@libs/platform/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto } from '@libs/platform/dto'
import { BaseAppUserCountDto, BaseAppUserDto } from '@libs/user'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

/**
 * 更新用户资料 DTO
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
 * 查询我的经验记录 DTO
 */
export class QueryMyExperienceRecordDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseUserExperienceRecordDto, ['ruleId'] as const)),
) {}

/**
 * 查询我的徽章 DTO
 */
export class QueryMyBadgeDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(
      BaseUserBadgeDto,
      ['name', 'type', 'isEnabled', 'business', 'eventKey'] as const,
    ),
  ),
) {}

export class UserExperienceRecordDto extends PickType(BaseUserExperienceRecordDto, [
  'id',
  'userId',
  'ruleId',
  'remark',
  'createdAt',
] as const) {
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

export class UserCountDto extends PickType(BaseAppUserCountDto, [
  'commentCount',
  'likeCount',
  'favoriteCount',
  'followingCount',
  'followersCount',
  'forumTopicCount',
  'commentReceivedLikeCount',
  'forumTopicReceivedLikeCount',
  'forumTopicReceivedFavoriteCount',
] as const) {}

/**
 * 用户状态摘要 DTO
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
 * 用户积分统计 DTO
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
 * 用户等级摘要 DTO
 *
 * 复用 BaseUserLevelRuleDto 中的等级信息字段
 */
export class UserLevelSummaryDto extends PickType(BaseUserLevelRuleDto, [
  'id',
  'name',
  'requiredExperience',
] as const) {}

/**
 * 用户经验统计 DTO
 *
 * 等级信息复用 UserLevelSummaryDto
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
  })
  level?: UserLevelSummaryDto

  @NestedProperty({
    description: '下一等级信息',
    type: UserLevelSummaryDto,
    required: false,
    validation: false,
  })
  nextLevel?: UserLevelSummaryDto

  @NumberProperty({
    description: '距离下一等级的经验值差距',
    example: 50,
    required: false,
    validation: false,
  })
  gapToNextLevel?: number
}

/**
 * 用户成长汇总 DTO
 */
export class UserGrowthSummaryDto {
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

  @NumberProperty({
    description: '今日获得积分',
    example: 15,
    validation: false,
  })
  todayPointEarned!: number

  @NumberProperty({
    description: '今日获得经验值',
    example: 20,
    validation: false,
  })
  todayExperienceEarned!: number
}

/**
 * 用户中心-用户信息 DTO
 *
 * 复用 BaseAppUserDto 中的用户基本信息字段
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
 * 用户中心-成长信息 DTO
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
 * 用户中心-用户资料 DTO
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
  })
  counts!: UserCountDto
}

/**
 * 用户中心-消息信息 DTO
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
 * 用户资产统计 DTO
 */
export class UserAssetsSummaryDto extends PickType(BaseUserAssetsSummaryDto, [
  'purchasedWorkCount',
  'purchasedChapterCount',
  'downloadedWorkCount',
  'downloadedChapterCount',
  'favoriteCount',
  'likeCount',
  'viewCount',
  'commentCount',
] as const) {}

/**
 * 用户中心汇总 DTO
 */
export class UserCenterDto {
  @NestedProperty({
    description: '用户基本信息',
    type: UserCenterUserDto,
    validation: false,
  })
  user!: UserCenterUserDto

  @NestedProperty({
    description: '成长信息',
    type: UserCenterGrowthDto,
    validation: false,
  })
  growth!: UserCenterGrowthDto

  @NestedProperty({
    description: '用户资料',
    type: UserCenterProfileDto,
    validation: false,
  })
  profile!: UserCenterProfileDto

  @NestedProperty({
    description: '资产统计',
    type: UserAssetsSummaryDto,
    validation: false,
  })
  assets!: UserAssetsSummaryDto

  @NestedProperty({
    description: '消息统计',
    type: UserCenterMessageDto,
    validation: false,
  })
  message!: UserCenterMessageDto
}

/**
 * 用户徽章项 DTO
 */
export class UserBadgeItemDto extends PickType(BaseDto, ['id', 'createdAt']) {
  @NestedProperty({
    description: '徽章详情',
    type: BaseUserBadgeDto,
    validation: false,
  })
  badge!: BaseUserBadgeDto
}
