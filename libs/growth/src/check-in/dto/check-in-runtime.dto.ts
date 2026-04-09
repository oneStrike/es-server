import { ArrayProperty } from '@libs/platform/decorators/validate/array-property';
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { BaseCheckInCycleDto } from './check-in-cycle.dto'
import {
  CheckInPageNoDateDto,
  CheckInRecordIdDto,
  CheckInRemainingMakeupCountDto,
  OptionalCheckInGrantIdDto,
  OptionalCheckInRecordIdDto,
} from './check-in-fragment.dto'
import { BaseCheckInPlanDto } from './check-in-plan.dto'
import { BaseCheckInRecordDto } from './check-in-record.dto'
import { CheckInRewardConfigDto } from './check-in-reward-config.dto'
import { CheckInGrantItemDto } from './check-in-streak-reward-grant.dto'
import { CheckInStreakRewardRuleItemDto } from './check-in-streak-reward-rule.dto'

class OptionalCycleIdDto {
  @NumberProperty({
    description: '周期实例 ID。',
    example: 10,
    required: false,
    validation: false,
  })
  id?: number
}

class CheckInGrantStatusFilterDto extends PartialType(
  PickType(CheckInGrantItemDto, ['grantStatus'] as const),
) {}

class OptionalCheckInRecordStateDto extends PartialType(
  PickType(BaseCheckInRecordDto, [
    'recordType',
    'rewardStatus',
    'rewardResultType',
    'rewardDayIndex',
  ] as const),
) {}

class CheckInReconciliationFilterDto extends IntersectionType(
  PartialType(
    PickType(BaseCheckInRecordDto, [
      'planId',
      'userId',
      'cycleId',
      'rewardStatus',
    ] as const),
  ),
  CheckInGrantStatusFilterDto,
) {}

class CheckInReconciliationRecordBaseDto extends OmitType(
  BaseCheckInRecordDto,
  [
    'id',
    'bizKey',
    'updatedAt',
    'operatorType',
    'remark',
    'context',
    'rewardSettledAt',
  ] as const,
) {}

class OptionalCheckInCycleWindowDto extends PartialType(
  PickType(BaseCheckInCycleDto, [
    'cycleKey',
    'cycleStartDate',
    'cycleEndDate',
  ] as const),
) {}

export class QueryCheckInReconciliationDto extends IntersectionType(
  CheckInPageNoDateDto,
  CheckInReconciliationFilterDto,
  OptionalCheckInRecordIdDto,
  OptionalCheckInGrantIdDto,
) {}

export class CheckInRecordItemDto extends OmitType(BaseCheckInRecordDto, [
  'bizKey',
  'updatedAt',
  'userId',
  'planId',
  'cycleId',
  'operatorType',
  'remark',
  'context',
] as const) {
  @ArrayProperty({
    description: '该签到日期触发的连续奖励列表。',
    itemClass: CheckInGrantItemDto,
    itemType: 'object',
    validation: false,
  })
  grants!: CheckInGrantItemDto[]
}

export class CheckInSummaryPlanDto extends OmitType(BaseCheckInPlanDto, [
  'createdAt',
  'updatedAt',
  'version',
] as const) {}

export class CheckInSummaryCycleDto extends IntersectionType(
  OptionalCycleIdDto,
  PickType(BaseCheckInCycleDto, [
    'cycleKey',
    'cycleStartDate',
    'cycleEndDate',
    'signedCount',
    'makeupUsedCount',
    'currentStreak',
    'lastSignedDate',
  ] as const),
  CheckInRemainingMakeupCountDto,
) {}

export class CheckInSummaryResponseDto {
  @NestedProperty({
    description: '当前生效计划摘要。',
    type: CheckInSummaryPlanDto,
    required: false,
    nullable: true,
    validation: false,
  })
  plan?: CheckInSummaryPlanDto | null

  @NestedProperty({
    description: '当前周期摘要。',
    type: CheckInSummaryCycleDto,
    required: false,
    nullable: true,
    validation: false,
  })
  cycle?: CheckInSummaryCycleDto | null

  @BooleanProperty({
    description: '今天是否已签到。',
    example: true,
    validation: false,
  })
  todaySigned!: boolean

  @NestedProperty({
    description: '下一档连续奖励。',
    type: CheckInStreakRewardRuleItemDto,
    required: false,
    nullable: true,
    validation: false,
  })
  nextStreakReward?: CheckInStreakRewardRuleItemDto | null

  @NestedProperty({
    description: '最近一条签到记录。',
    type: CheckInRecordItemDto,
    required: false,
    nullable: true,
    validation: false,
  })
  latestRecord?: CheckInRecordItemDto | null
}

export class CheckInCalendarDayDto extends IntersectionType(
  PickType(BaseCheckInRecordDto, ['signDate'] as const),
  OptionalCheckInRecordStateDto,
) {
  @NumberProperty({
    description: '该自然日在当前周期中的奖励天序号。',
    example: 3,
    validation: false,
  })
  dayIndex!: number

  @BooleanProperty({
    description: '该日期是否位于当前计划生效窗口内。',
    example: true,
    validation: false,
  })
  inPlanWindow!: boolean

  @NestedProperty({
    description: '该自然日计划基础奖励；为空表示当天没有基础奖励。',
    type: CheckInRewardConfigDto,
    required: false,
    nullable: true,
    validation: false,
  })
  planRewardConfig?: CheckInRewardConfigDto | null

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
    description: '该签到日期触发的连续奖励数量。',
    example: 1,
    validation: false,
  })
  grantCount!: number
}

class CheckInCalendarContextDto {
  @NumberProperty({
    description: '签到计划 ID。',
    example: 1,
    required: false,
    validation: false,
  })
  planId?: number

  @NumberProperty({
    description: '周期实例 ID。',
    example: 10,
    required: false,
    validation: false,
  })
  cycleId?: number

  @ArrayProperty({
    description: '当前周期日历。',
    itemClass: CheckInCalendarDayDto,
    itemType: 'object',
    validation: false,
  })
  days!: CheckInCalendarDayDto[]
}

export class CheckInCalendarResponseDto extends IntersectionType(
  OptionalCheckInCycleWindowDto,
  CheckInCalendarContextDto,
) {}

export class CheckInReconciliationItemDto extends IntersectionType(
  CheckInReconciliationRecordBaseDto,
  CheckInRecordIdDto,
) {
  @ArrayProperty({
    description: '关联的连续奖励发放列表。',
    itemClass: CheckInGrantItemDto,
    itemType: 'object',
    validation: false,
  })
  grants!: CheckInGrantItemDto[]
}
