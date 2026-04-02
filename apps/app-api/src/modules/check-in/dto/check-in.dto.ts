import {
  BaseCheckInCycleDto,
  BaseCheckInPlanDto,
  BaseCheckInRecordDto,
  BaseCheckInStreakRewardGrantDto,
  BaseCheckInStreakRewardRuleDto,
} from '@libs/growth/check-in'
import {
  ArrayProperty,
  BooleanProperty,
  NestedProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

class CheckInCycleWindowDto extends PickType(BaseCheckInCycleDto, [
  'cycleKey',
  'cycleStartDate',
  'cycleEndDate',
] as const) {}

class OptionalCheckInRecordStateDto extends PartialType(
  PickType(BaseCheckInRecordDto, [
    'recordType',
    'rewardStatus',
    'rewardResultType',
  ] as const),
) {}

class AppCheckInActionBaseDto extends IntersectionType(
  PickType(BaseCheckInRecordDto, [
    'signDate',
    'recordType',
    'rewardStatus',
    'rewardResultType',
  ] as const),
  PickType(BaseCheckInCycleDto, ['currentStreak', 'signedCount'] as const),
) {}

class RemainingMakeupCountDto {
  @NumberProperty({
    description: '当前周期剩余补签次数',
    example: 1,
    validation: false,
  })
  remainingMakeupCount!: number
}

export class MakeupCheckInDto extends PickType(BaseCheckInRecordDto, [
  'signDate',
] as const) {}

export class AppCheckInGrantItemDto extends PickType(
  BaseCheckInStreakRewardGrantDto,
  [
    'id',
    'ruleId',
    'triggerSignDate',
    'grantStatus',
    'grantResultType',
    'ledgerIds',
    'lastGrantError',
  ] as const,
) {}

export class AppCheckInRecordItemDto extends PickType(BaseCheckInRecordDto, [
  'id',
  'createdAt',
  'signDate',
  'recordType',
  'rewardStatus',
  'rewardResultType',
  'baseRewardLedgerIds',
  'lastRewardError',
  'rewardSettledAt',
] as const) {
  @ArrayProperty({
    description: '该签到日期触发的连续奖励列表',
    itemClass: AppCheckInGrantItemDto,
    itemType: 'object',
    validation: false,
  })
  grants!: AppCheckInGrantItemDto[]
}

export class AppCheckInNextRewardDto extends PickType(
  BaseCheckInStreakRewardRuleDto,
  [
    'id',
    'ruleCode',
    'streakDays',
    'rewardConfig',
    'repeatable',
    'status',
  ] as const,
) {}

export class AppCheckInSummaryPlanDto extends PickType(BaseCheckInPlanDto, [
  'id',
  'planCode',
  'planName',
  'status',
  'cycleType',
  'startDate',
  'allowMakeupCountPerCycle',
  'baseRewardConfig',
  'endDate',
] as const) {}

export class AppCheckInSummaryCycleDto extends IntersectionType(
  PickType(BaseCheckInCycleDto, [
    'id',
    'cycleKey',
    'cycleStartDate',
    'cycleEndDate',
    'signedCount',
    'makeupUsedCount',
    'currentStreak',
    'lastSignedDate',
  ] as const),
  RemainingMakeupCountDto,
) {}

export class AppCheckInSummaryResponseDto {
  @NestedProperty({
    description: '当前生效计划摘要',
    type: AppCheckInSummaryPlanDto,
    required: false,
    nullable: true,
    validation: false,
  })
  plan?: AppCheckInSummaryPlanDto | null

  @NestedProperty({
    description: '当前周期摘要',
    type: AppCheckInSummaryCycleDto,
    required: false,
    nullable: true,
    validation: false,
  })
  cycle?: AppCheckInSummaryCycleDto | null

  @BooleanProperty({
    description: '今天是否已签到',
    example: true,
    validation: false,
  })
  todaySigned!: boolean

  @NestedProperty({
    description: '下一档连续奖励',
    type: AppCheckInNextRewardDto,
    required: false,
    nullable: true,
    validation: false,
  })
  nextStreakReward?: AppCheckInNextRewardDto | null

  @NestedProperty({
    description: '最近一条签到记录',
    type: AppCheckInRecordItemDto,
    required: false,
    nullable: true,
    validation: false,
  })
  latestRecord?: AppCheckInRecordItemDto | null
}

export class AppCheckInCalendarDayDto extends IntersectionType(
  PickType(BaseCheckInRecordDto, ['signDate'] as const),
  OptionalCheckInRecordStateDto,
) {
  @BooleanProperty({
    description: '是否为今天',
    example: true,
    validation: false,
  })
  isToday!: boolean

  @BooleanProperty({
    description: '是否为未来日期',
    example: false,
    validation: false,
  })
  isFuture!: boolean

  @BooleanProperty({
    description: '该日是否已签到',
    example: true,
    validation: false,
  })
  isSigned!: boolean

  @NumberProperty({
    description: '连续奖励数量',
    example: 1,
    validation: false,
  })
  grantCount!: number
}

class AppCheckInCalendarContextDto {
  @NumberProperty({
    description: '签到计划ID',
    example: 1,
    required: false,
    validation: false,
  })
  planId?: number

  @NumberProperty({
    description: '周期实例ID',
    example: 10,
    required: false,
    validation: false,
  })
  cycleId?: number

  @ArrayProperty({
    description: '当前周期日历',
    itemClass: AppCheckInCalendarDayDto,
    itemType: 'object',
    validation: false,
  })
  days!: AppCheckInCalendarDayDto[]
}

export class AppCheckInCalendarBodyDto extends IntersectionType(
  PartialType(CheckInCycleWindowDto),
  AppCheckInCalendarContextDto,
) {}

export class AppCheckInActionResponseDto extends IntersectionType(
  AppCheckInActionBaseDto,
  RemainingMakeupCountDto,
) {
  @NumberProperty({
    description: '签到记录ID',
    example: 100,
    validation: false,
  })
  recordId!: number

  @NumberProperty({
    description: '周期实例ID',
    example: 10,
    validation: false,
  })
  cycleId!: number

  @ArrayProperty({
    description: '本次触发的连续奖励发放事实 ID 列表',
    itemType: 'number',
    example: [201],
    validation: false,
  })
  triggeredGrantIds!: number[]

  @BooleanProperty({
    description: '是否命中幂等并复用既有签到记录',
    example: false,
    validation: false,
  })
  alreadyExisted!: boolean
}
