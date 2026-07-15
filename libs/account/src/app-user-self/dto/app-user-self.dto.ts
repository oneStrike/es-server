import { BaseUserAssetsSummaryDto } from '@libs/account/user-assets/dto/user-assets.dto'
import { UserGrowthSnapshotFieldsDto } from '@libs/growth/dto/app-user-growth-shared.dto'
import { BaseNotificationUnreadDto } from '@libs/message/notification/dto/notification-unread.dto'
import {
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseAppUserCountDto } from '@libs/user/dto/base-app-user-count.dto'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import { IntersectionType, OmitType, PickType } from '@nestjs/swagger'

/** 当前用户公开资料与成长余额的组合响应。 */
export class AppUserProfileDto extends IntersectionType(
  BaseAppUserDto,
  UserGrowthSnapshotFieldsDto,
) {}

export class UserCenterUserDto extends PickType(BaseAppUserDto, [
  'id',
  'account',
  'phoneNumber',
  'nickname',
  'avatarUrl',
  'profileBackgroundImageUrl',
  'emailAddress',
  'genderType',
  'birthDate',
] as const) {}

export class UserCenterGrowthDto extends UserGrowthSnapshotFieldsDto {
  @NumberProperty({
    description: '当前等级ID',
    example: 1,
    nullable: true,
    validation: false,
  })
  levelId!: number | null

  @StringProperty({
    description: '当前等级名称',
    example: '新手',
    nullable: true,
    validation: false,
  })
  levelName!: string | null

  @StringProperty({
    description: '当前等级图标 URL',
    example: 'https://cdn.example.com/level/rookie.png',
    nullable: true,
    validation: false,
  })
  levelIcon!: string | null

  @StringProperty({
    description: '当前等级颜色',
    example: '#FF5733',
    nullable: true,
    validation: false,
  })
  levelColor!: string | null

  @NumberProperty({ description: '徽章数量', example: 3, validation: false })
  badgeCount!: number
}

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

export class UserCenterProfileDto extends PickType(BaseAppUserDto, [
  'signature',
  'bio',
  'status',
  'banReason',
  'banUntil',
] as const) {
  @NestedProperty({
    description: '用户计数',
    type: OmitType(BaseAppUserCountDto, [
      'userId',
      'createdAt',
      'updatedAt',
    ] as const),
    validation: false,
    nullable: false,
  })
  counts!: Omit<BaseAppUserCountDto, 'userId' | 'createdAt' | 'updatedAt'>
}

export class UserCenterLastLoginGeoDto {
  @StringProperty({
    description: '最近一次登录IP归属国家/地区',
    example: '中国',
    nullable: true,
    maxLength: 100,
    validation: false,
  })
  geoCountry!: string | null

  @StringProperty({
    description: '最近一次登录IP归属省份',
    example: '广东省',
    nullable: true,
    maxLength: 100,
    validation: false,
  })
  geoProvince!: string | null

  @StringProperty({
    description: '最近一次登录IP归属城市',
    example: '深圳市',
    nullable: true,
    maxLength: 100,
    validation: false,
  })
  geoCity!: string | null

  @StringProperty({
    description: '最近一次登录IP归属运营商',
    example: '电信',
    nullable: true,
    maxLength: 100,
    validation: false,
  })
  geoIsp!: string | null
}

export class UserCenterMessageDto {
  @NestedProperty({
    description: '通知未读摘要',
    type: BaseNotificationUnreadDto,
    validation: false,
    nullable: false,
  })
  notificationUnread!: BaseNotificationUnreadDto

  @NumberProperty({
    description: '收件箱未读消息总数',
    example: 5,
    validation: false,
  })
  totalUnreadCount!: number
}

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
    description: '最近一次登录IP属地',
    type: UserCenterLastLoginGeoDto,
    validation: false,
    nullable: false,
  })
  lastLoginGeo!: UserCenterLastLoginGeoDto

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
