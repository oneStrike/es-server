import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

import {
  CheckInMakeupPeriodTypeEnum,
  CheckInStreakPublishStrategyEnum,
} from '../check-in.constant'
import { CheckInDateRewardRuleFieldsDto } from './check-in-date-reward-rule.dto'
import { BaseCheckInPatternRewardRuleDto } from './check-in-pattern-reward-rule.dto'
import { BaseCheckInStreakRewardRuleDto } from './check-in-streak-reward-rule.dto'

export class UpdateCheckInConfigDto {
  @BooleanProperty({
    description: '是否启用签到功能。',
    example: true,
  })
  isEnabled!: boolean

  @EnumProperty({
    description: '补签周期类型（1=按自然周；2=按自然月）。',
    example: CheckInMakeupPeriodTypeEnum.WEEKLY,
    enum: CheckInMakeupPeriodTypeEnum,
  })
  makeupPeriodType!: CheckInMakeupPeriodTypeEnum

  @NumberProperty({
    description: '每周期系统发放的补签额度。',
    example: 2,
    min: 0,
  })
  periodicAllowance!: number

  @ArrayProperty({
    description: '默认基础奖励项。',
    itemClass: GrowthRewardItemDto,
    required: false,
  })
  baseRewardItems?: GrowthRewardItemDto[] | null

  @ArrayProperty({
    description: '具体日期奖励规则列表。',
    itemClass: CheckInDateRewardRuleFieldsDto,
    required: false,
  })
  dateRewardRules?: CheckInDateRewardRuleFieldsDto[]

  @ArrayProperty({
    description: '周期模式奖励规则列表。',
    itemClass: BaseCheckInPatternRewardRuleDto,
    required: false,
  })
  patternRewardRules?: BaseCheckInPatternRewardRuleDto[]
}

export class UpdateCheckInEnabledDto extends PickType(UpdateCheckInConfigDto, [
  'isEnabled',
] as const) {}

export class CheckInConfigDetailResponseDto extends IntersectionType(
  BaseDto,
  UpdateCheckInConfigDto,
) {}

export class QueryCheckInStreakRulePageDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseCheckInStreakRewardRuleDto, ['streakDays', 'status'] as const),
  ),
) {}

export class QueryCheckInStreakRuleHistoryPageDto extends IntersectionType(
  PageDto,
  PickType(BaseCheckInStreakRewardRuleDto, ['streakDays'] as const),
) {}

export class PublishCheckInStreakRuleDto extends PickType(
  BaseCheckInStreakRewardRuleDto,
  ['streakDays', 'repeatable', 'rewardItems'] as const,
) {
  @EnumProperty({
    description: '发布策略（1=立即生效；2=次日生效；3=指定时间生效）。',
    example: CheckInStreakPublishStrategyEnum.NEXT_DAY,
    enum: CheckInStreakPublishStrategyEnum,
  })
  publishStrategy!: CheckInStreakPublishStrategyEnum

  @StringProperty({
    description: '指定生效时间；仅当发布策略需要明确时间点时传入。',
    example: '2026-04-20T00:00:00.000Z',
    required: false,
  })
  effectiveFrom?: string
}

export class CheckInStreakRuleDetailResponseDto extends IntersectionType(
  BaseDto,
  PickType(BaseCheckInStreakRewardRuleDto, [
    'ruleCode',
    'streakDays',
    'status',
    'repeatable',
    'rewardItems',
  ] as const),
) {
  @NumberProperty({
    description: '记录版本号。',
    example: 2,
    validation: false,
  })
  version!: number

  @EnumProperty({
    description: '发布策略（1=立即生效；2=次日生效；3=指定时间生效）。',
    example: CheckInStreakPublishStrategyEnum.NEXT_DAY,
    enum: CheckInStreakPublishStrategyEnum,
    validation: false,
  })
  publishStrategy!: CheckInStreakPublishStrategyEnum

  @BooleanProperty({
    description: '是否为当前生效版本。',
    example: true,
    validation: false,
  })
  isCurrent!: boolean

  @StringProperty({
    description: '生效开始时间。',
    example: '2026-04-19T00:00:00.000Z',
    validation: false,
  })
  effectiveFrom!: string | Date

  @StringProperty({
    description: '生效结束时间。',
    example: '2026-04-20T00:00:00.000Z',
    required: false,
    validation: false,
  })
  effectiveTo?: string | Date | null
}
