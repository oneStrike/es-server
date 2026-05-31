import {
  ArrayProperty,
  BooleanProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import { ApiExtraModels, ApiProperty, PickType } from '@nestjs/swagger'
import { CheckInRewardItemDto } from './check-in-reward-item.dto'
import {
  CheckInCalendarResponseDto,
  CheckInRecordItemDto,
} from './check-in-runtime.dto'

class CheckInCalendarWindowDto extends PickType(CheckInCalendarResponseDto, [
  'periodType',
  'periodKey',
  'periodStartDate',
  'periodEndDate',
] as const) {}

export class AdminCheckInCalendarDayDto {
  @StringProperty({
    description: '自然日。',
    example: '2026-04-23',
    validation: false,
  })
  signDate!: string

  @NumberProperty({
    description: '当前周期内展示序号。',
    example: 4,
    validation: false,
  })
  dayIndex!: number

  @BooleanProperty({
    description: '是否为今天。',
    example: false,
    validation: false,
  })
  isToday!: boolean

  @BooleanProperty({
    description: '是否为未来日期。',
    example: false,
    validation: false,
  })
  isFuture!: boolean

  @NumberProperty({
    description: '当日已签到用户数（按 distinct userId 统计）。',
    example: 16,
    validation: false,
  })
  signedCount!: number

  @NumberProperty({
    description: '当日正常签到用户数（按 distinct userId 统计）。',
    example: 12,
    validation: false,
  })
  normalSignCount!: number

  @NumberProperty({
    description: '当日补签用户数（按 distinct userId 统计）。',
    example: 4,
    validation: false,
  })
  makeupSignCount!: number

  @NumberProperty({
    description: '当日连续奖励触发次数（按 grant 行数统计，不做用户去重）。',
    example: 3,
    validation: false,
  })
  streakRewardTriggerCount!: number

  @ArrayProperty({
    description:
      '当前生效配置对该日期的奖励规则投影视图；这是 current-config projection，不是历史冻结配置快照。',
    itemClass: CheckInRewardItemDto,
    required: false,
    validation: false,
  })
  baseRewardConfigProjectionOverview?: CheckInRewardItemDto[] | null

  @StringProperty({
    description: '当前生效配置对该日期的奖励概览图标 URL。',
    example: 'https://cdn.example.com/check-in/reward-overview.png',
    required: false,
    validation: false,
  })
  baseRewardConfigProjectionOverviewIconUrl?: string | null

  @ArrayProperty({
    description: '按签到事实冻结奖励快照聚合出的当日基础奖励实际概览。',
    itemClass: CheckInRewardItemDto,
    required: false,
    validation: false,
  })
  baseRewardActualOverview?: CheckInRewardItemDto[] | null

  @StringProperty({
    description: '按签到事实冻结奖励快照聚合出的当日基础奖励概览图标 URL。',
    example: 'https://cdn.example.com/check-in/reward-overview.png',
    required: false,
    validation: false,
  })
  baseRewardActualOverviewIconUrl?: string | null
}

export class AdminCheckInCalendarDetailResponseDto extends CheckInCalendarWindowDto {
  @ArrayProperty({
    description: '目标周期内按天汇总的后台签到日历。',
    itemClass: AdminCheckInCalendarDayDto,
    validation: false,
  })
  days!: AdminCheckInCalendarDayDto[]
}

export class AdminCheckInCalendarOverviewCounterDto {
  @NumberProperty({
    description: '已签到用户数（按 distinct userId 统计）。',
    example: 16,
    validation: false,
  })
  signedCount!: number

  @NumberProperty({
    description: '正常签到用户数（按 distinct userId 统计）。',
    example: 12,
    validation: false,
  })
  normalSignCount!: number

  @NumberProperty({
    description: '补签用户数（按 distinct userId 统计）。',
    example: 4,
    validation: false,
  })
  makeupSignCount!: number

  @NumberProperty({
    description: '连续奖励触发次数（按 grant 行数统计，不做用户去重）。',
    example: 3,
    validation: false,
  })
  streakRewardTriggerCount!: number
}

export class AdminCheckInCalendarOverviewTargetDto extends AdminCheckInCalendarOverviewCounterDto {
  @StringProperty({
    description: '目标自然日。',
    example: '2026-04-23',
    validation: false,
  })
  signDate!: string
}

export class AdminCheckInCalendarOverviewResponseDto extends CheckInCalendarWindowDto {
  @NestedProperty({
    description: '目标日期当天概览。',
    type: AdminCheckInCalendarOverviewTargetDto,
    validation: false,
  })
  targetDay!: AdminCheckInCalendarOverviewTargetDto

  @NestedProperty({
    description: '目标周期截至统计截止日期的概览。',
    type: AdminCheckInCalendarOverviewCounterDto,
    validation: false,
  })
  periodToDate!: AdminCheckInCalendarOverviewCounterDto

  @StringProperty({
    description: '周期统计截止日期，未来目标周期最多统计到今天。',
    example: '2026-04-23',
    validation: false,
  })
  cutoffDate!: string
}

export class AdminUserCheckInCalendarDetailResponseDto extends CheckInCalendarResponseDto {}

export class AdminCheckInSignedUserDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) {}

@ApiExtraModels(AdminCheckInSignedUserDto)
export class AdminCheckInSignedUserPageItemDto extends CheckInRecordItemDto {
  @ApiProperty({
    description: '已签用户信息。',
    required: false,
    nullable: true,
    type: AdminCheckInSignedUserDto,
  })
  user?: AdminCheckInSignedUserDto | null
}
