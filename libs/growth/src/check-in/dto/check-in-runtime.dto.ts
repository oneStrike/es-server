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
import { CheckInMakeupPeriodTypeEnum } from '../check-in.constant'
import {
  CheckInConfigDetailResponseDto,
  CheckInStreakRoundDetailResponseDto,
} from './check-in-definition.dto'
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

  @NumberProperty({
    description: '轮次配置 ID。',
    example: 1,
    required: false,
    validation: false,
  })
  roundConfigId?: number

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

  @NumberProperty({
    description: '当前轮次迭代号。',
    example: 1,
    validation: false,
  })
  roundIteration!: number
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

export class CheckInStreakSummaryDto {
  @NumberProperty({
    description: '当前轮次配置 ID。',
    example: 1,
    validation: false,
  })
  roundConfigId!: number

  @StringProperty({
    description: '当前轮次编码。',
    example: 'default-round',
    validation: false,
  })
  roundCode!: string

  @NumberProperty({
    description: '当前轮次版本号。',
    example: 1,
    validation: false,
  })
  version!: number

  @NumberProperty({
    description: '当前轮次迭代号。',
    example: 1,
    validation: false,
  })
  roundIteration!: number

  @NumberProperty({
    description: '当前连续签到天数。',
    example: 3,
    validation: false,
  })
  currentStreak!: number

  @StringProperty({
    description: '当前轮开始日期。',
    example: '2026-04-17',
    required: false,
    validation: false,
  })
  roundStartedAt?: string

  @StringProperty({
    description: '最近一次有效签到日期。',
    example: '2026-04-19',
    required: false,
    validation: false,
  })
  lastSignedDate?: string

  @NestedProperty({
    description: '当前轮次详情。',
    type: CheckInStreakRoundDetailResponseDto,
    validation: false,
  })
  round!: CheckInStreakRoundDetailResponseDto

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
    description: '当前连续奖励进度摘要。',
    type: CheckInStreakSummaryDto,
    validation: false,
  })
  streak!: CheckInStreakSummaryDto

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
    description: '该日期触发的连续奖励数量。',
    example: 1,
    validation: false,
  })
  grantCount!: number

  @ArrayProperty({
    description: '该日期命中的基础奖励项。',
    itemClass: GrowthRewardItemDto,
    required: false,
    validation: false,
  })
  rewardItems?: GrowthRewardItemDto[] | null

  @NestedProperty({
    description: '基础奖励补偿摘要。',
    type: CheckInRewardSettlementSummaryDto,
    required: false,
    nullable: false,
    validation: false,
  })
  rewardSettlement?: CheckInRewardSettlementSummaryDto | null
}

export class CheckInCalendarResponseDto {
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

  @ArrayProperty({
    description: '当前周期日历。',
    itemClass: CheckInCalendarDayDto,
    validation: false,
  })
  days!: CheckInCalendarDayDto[]
}

export class CheckInReconciliationItemDto extends CheckInRecordItemDto {
  @NumberProperty({
    description: '签到记录 ID。',
    example: 1,
    validation: false,
  })
  recordId!: number

  @NumberProperty({
    description: '归属用户 ID。',
    example: 1,
    validation: false,
  })
  userId!: number
}
