import { GrowthRewardSettlementStatusEnum } from '@libs/growth/growth-reward/growth-reward.constant'
import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { PageDto } from '@libs/platform/dto/page.dto'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import { PickType } from '@nestjs/swagger'
import {
  CheckInActivityStreakStatusEnum,
  CheckInMakeupPeriodTypeEnum,
  CheckInStreakScopeTypeEnum,
} from '../check-in.constant'
import { CheckInConfigDetailResponseDto } from './check-in-definition.dto'
import {
  BaseCheckInRecordDto,
  CheckInRewardSettlementSummaryDto,
} from './check-in-record.dto'
import { CheckInGrantItemDto } from './check-in-streak-reward-grant.dto'
import { CheckInStreakRewardRuleItemDto } from './check-in-streak-reward-rule.dto'

export class QueryCheckInLeaderboardDto extends PickType(PageDto, [
  'pageIndex',
  'pageSize',
] as const) {}

export class QueryCheckInReconciliationDto extends PageDto {
  @NumberProperty({
    description: '签到记录 ID。',
    example: 1,
    required: false,
    validation: false,
  })
  recordId?: number

  @NumberProperty({
    description: '连续奖励 grant ID。',
    example: 1,
    required: false,
    validation: false,
  })
  grantId?: number

  @NumberProperty({
    description: '用户 ID。',
    example: 1,
    required: false,
    validation: false,
  })
  userId?: number

  @EnumProperty({
    description: '连续奖励作用域（1=日常连续签到；2=活动连续签到）。',
    example: CheckInStreakScopeTypeEnum.DAILY,
    enum: CheckInStreakScopeTypeEnum,
    required: false,
  })
  scopeType?: CheckInStreakScopeTypeEnum

  @NumberProperty({
    description: '日常连续签到配置版本 ID。',
    example: 1,
    required: false,
    validation: false,
  })
  configVersionId?: number

  @NumberProperty({
    description: '活动连续签到活动 ID。',
    example: 1,
    required: false,
    validation: false,
  })
  activityId?: number

  @EnumProperty({
    description: '基础奖励结算状态（0=待补偿重试；1=已补偿成功；2=终态失败）。',
    example: GrowthRewardSettlementStatusEnum.PENDING,
    enum: GrowthRewardSettlementStatusEnum,
    required: false,
  })
  recordSettlementStatus?: GrowthRewardSettlementStatusEnum

  @EnumProperty({
    description: '连续奖励结算状态（0=待补偿重试；1=已补偿成功；2=终态失败）。',
    example: GrowthRewardSettlementStatusEnum.PENDING,
    enum: GrowthRewardSettlementStatusEnum,
    required: false,
  })
  grantSettlementStatus?: GrowthRewardSettlementStatusEnum
}

export class CheckInLeaderboardUserDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) {}

export class CheckInLeaderboardItemDto {
  @NumberProperty({
    description: '排行榜名次。',
    example: 1,
    validation: false,
  })
  rank!: number

  @NestedProperty({
    description: '上榜用户信息。',
    type: CheckInLeaderboardUserDto,
    validation: false,
  })
  user!: CheckInLeaderboardUserDto

  @NumberProperty({
    description: '当前连续签到天数。',
    example: 5,
    validation: false,
  })
  currentStreak!: number

  @StringProperty({
    description: '最近一次有效签到日期。',
    example: '2026-04-19',
    required: false,
    validation: false,
  })
  lastSignedDate?: string
}

export class CheckInRecordItemDto extends BaseCheckInRecordDto {
  @ArrayProperty({
    description: '该签到日期触发的连续奖励列表。',
    itemClass: CheckInGrantItemDto,
    validation: false,
  })
  grants!: CheckInGrantItemDto[]

  @NestedProperty({
    description: '基础奖励补偿摘要。',
    type: CheckInRewardSettlementSummaryDto,
    required: false,
    nullable: false,
    validation: false,
  })
  rewardSettlement?: CheckInRewardSettlementSummaryDto | null
}

export class CheckInMakeupSummaryDto {
  @EnumProperty({
    description: '当前补签周期类型（1=按自然周；2=按自然月）。',
    example: CheckInMakeupPeriodTypeEnum.WEEKLY,
    enum: CheckInMakeupPeriodTypeEnum,
    validation: false,
  })
  periodType!: CheckInMakeupPeriodTypeEnum

  @StringProperty({
    description: '当前补签周期键。',
    example: 'week-2026-04-14',
    validation: false,
  })
  periodKey!: string

  @StringProperty({
    description: '当前补签周期开始日期。',
    example: '2026-04-14',
    validation: false,
  })
  periodStartDate!: string

  @StringProperty({
    description: '当前补签周期结束日期。',
    example: '2026-04-20',
    validation: false,
  })
  periodEndDate!: string

  @NumberProperty({
    description: '当前周期系统发放额度。',
    example: 2,
    validation: false,
  })
  periodicGranted!: number

  @NumberProperty({
    description: '当前周期已消费系统额度。',
    example: 1,
    validation: false,
  })
  periodicUsed!: number

  @NumberProperty({
    description: '当前周期剩余系统额度。',
    example: 1,
    validation: false,
  })
  periodicRemaining!: number

  @NumberProperty({
    description: '活动补签卡余额。',
    example: 0,
    validation: false,
  })
  eventAvailable!: number
}

export class CheckInDailyStreakSummaryDto {
  @NumberProperty({
    description: '当前连续签到天数。',
    example: 3,
    validation: false,
  })
  currentStreak!: number

  @StringProperty({
    description: '当前连续区间开始日期。',
    example: '2026-04-17',
    required: false,
    validation: false,
  })
  streakStartedAt?: string

  @StringProperty({
    description: '最近一次有效签到日期。',
    example: '2026-04-19',
    required: false,
    validation: false,
  })
  lastSignedDate?: string

  @NestedProperty({
    description: '下一档连续奖励。',
    type: CheckInStreakRewardRuleItemDto,
    required: false,
    nullable: false,
    validation: false,
  })
  nextReward?: CheckInStreakRewardRuleItemDto | null
}

export class CheckInSummaryResponseDto {
  @NestedProperty({
    description: '当前全局签到配置。',
    type: CheckInConfigDetailResponseDto,
    validation: false,
  })
  config!: CheckInConfigDetailResponseDto

  @NestedProperty({
    description: '当前补签账户摘要。',
    type: CheckInMakeupSummaryDto,
    validation: false,
  })
  makeup!: CheckInMakeupSummaryDto

  @NestedProperty({
    description: '当前日常连续签到摘要。',
    type: CheckInDailyStreakSummaryDto,
    validation: false,
  })
  streak!: CheckInDailyStreakSummaryDto

  @BooleanProperty({
    description: '今天是否已签到。',
    example: true,
    validation: false,
  })
  todaySigned!: boolean

  @NestedProperty({
    description: '最近一条签到记录。',
    type: CheckInRecordItemDto,
    required: false,
    nullable: false,
    validation: false,
  })
  latestRecord?: CheckInRecordItemDto | null
}

export class CheckInActivityStreakItemDto {
  @NumberProperty({
    description: '活动 ID。',
    example: 1,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '活动稳定键。',
    example: 'summer-sign-in',
    validation: false,
  })
  activityKey!: string

  @StringProperty({
    description: '活动标题。',
    example: '夏日连续签到',
    validation: false,
  })
  title!: string

  @EnumProperty({
    description: '活动状态（0=草稿；1=已发布；2=已下线；3=已归档）。',
    example: CheckInActivityStreakStatusEnum.PUBLISHED,
    enum: CheckInActivityStreakStatusEnum,
    validation: false,
  })
  status!: CheckInActivityStreakStatusEnum

  @StringProperty({
    description: '活动开始时间。',
    example: '2026-04-19T00:00:00.000Z',
    validation: false,
  })
  effectiveFrom!: string | Date

  @StringProperty({
    description: '活动结束时间。',
    example: '2026-04-26T23:59:59.999Z',
    validation: false,
  })
  effectiveTo!: string | Date

  @NumberProperty({
    description: '当前活动连续签到天数。',
    example: 3,
    validation: false,
  })
  currentStreak!: number

  @StringProperty({
    description: '最近一次活动有效签到日期。',
    example: '2026-04-19',
    required: false,
    validation: false,
  })
  lastSignedDate?: string

  @NestedProperty({
    description: '下一档活动连续奖励。',
    type: CheckInStreakRewardRuleItemDto,
    required: false,
    nullable: false,
    validation: false,
  })
  nextReward?: CheckInStreakRewardRuleItemDto | null
}

export class CheckInActivityStreakDetailResponseDto extends CheckInActivityStreakItemDto {
  @StringProperty({
    description: '当前活动连续区间开始日期。',
    example: '2026-04-17',
    required: false,
    validation: false,
  })
  streakStartedAt?: string

  @ArrayProperty({
    description: '活动连续奖励规则列表。',
    itemClass: CheckInStreakRewardRuleItemDto,
    validation: false,
  })
  rewardRules!: CheckInStreakRewardRuleItemDto[]
}

export class CheckInCalendarDayDto {
  @StringProperty({
    description: '自然日。',
    example: '2026-04-19',
    validation: false,
  })
  signDate!: string

  @NumberProperty({
    description: '当前周期内展示序号。',
    example: 1,
    validation: false,
  })
  dayIndex!: number

  @BooleanProperty({
    description: '是否为今天。',
    example: true,
    validation: false,
  })
  isToday!: boolean

  @BooleanProperty({
    description: '是否为未来日期。',
    example: false,
    validation: false,
  })
  isFuture!: boolean

  @BooleanProperty({
    description: '该日是否已签到。',
    example: true,
    validation: false,
  })
  isSigned!: boolean

  @NumberProperty({
    description: '该日触发的连续奖励数量。',
    example: 1,
    validation: false,
  })
  grantCount!: number

  @ArrayProperty({
    description: '该日基础奖励快照。',
    itemClass: GrowthRewardItemDto,
    required: false,
    validation: false,
  })
  rewardItems?: GrowthRewardItemDto[] | null

  @NestedProperty({
    description: '该日基础奖励补偿摘要。',
    type: CheckInRewardSettlementSummaryDto,
    required: false,
    nullable: false,
    validation: false,
  })
  rewardSettlement?: CheckInRewardSettlementSummaryDto | null
}

export class CheckInCalendarResponseDto {
  @EnumProperty({
    description: '补签周期类型（1=按自然周；2=按自然月）。',
    example: CheckInMakeupPeriodTypeEnum.WEEKLY,
    enum: CheckInMakeupPeriodTypeEnum,
    validation: false,
  })
  periodType!: CheckInMakeupPeriodTypeEnum

  @StringProperty({
    description: '补签周期键。',
    example: 'week-2026-04-14',
    validation: false,
  })
  periodKey!: string

  @StringProperty({
    description: '周期开始日期。',
    example: '2026-04-14',
    validation: false,
  })
  periodStartDate!: string

  @StringProperty({
    description: '周期结束日期。',
    example: '2026-04-20',
    validation: false,
  })
  periodEndDate!: string

  @ArrayProperty({
    description: '周期内日历列表。',
    itemClass: CheckInCalendarDayDto,
    validation: false,
  })
  days!: CheckInCalendarDayDto[]
}

export class CheckInReconciliationItemDto extends CheckInRecordItemDto {}
