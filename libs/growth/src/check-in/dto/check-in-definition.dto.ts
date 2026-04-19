import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { BaseDto } from '@libs/platform/dto/base.dto'
import {
  CheckInMakeupPeriodTypeEnum,
  CheckInStreakNextRoundStrategyEnum,
  CheckInStreakRoundStatusEnum,
} from '../check-in.constant'
import {
  CheckInDateRewardRuleItemDto,
  CreateCheckInDateRewardRuleDto,
} from './check-in-date-reward-rule.dto'
import {
  CheckInPatternRewardRuleItemDto,
  CreateCheckInPatternRewardRuleDto,
} from './check-in-pattern-reward-rule.dto'
import {
  CheckInStreakRewardRuleItemDto,
  CreateCheckInStreakRewardRuleDto,
} from './check-in-streak-reward-rule.dto'

export class UpdateCheckInConfigDto {
  @BooleanProperty({
    description: '是否启用签到功能。',
    example: true,
  })
  enabled!: boolean

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
    itemClass: CreateCheckInDateRewardRuleDto,
    required: false,
  })
  dateRewardRules?: CreateCheckInDateRewardRuleDto[]

  @ArrayProperty({
    description: '周期模式奖励规则列表。',
    itemClass: CreateCheckInPatternRewardRuleDto,
    required: false,
  })
  patternRewardRules?: CreateCheckInPatternRewardRuleDto[]
}

export class UpdateCheckInEnabledDto {
  @BooleanProperty({
    description: '签到功能开关。',
    example: true,
  })
  enabled!: boolean
}

export class CheckInConfigDetailResponseDto extends BaseDto {
  @BooleanProperty({
    description: '签到功能开关。',
    example: true,
    validation: false,
  })
  enabled!: boolean

  @EnumProperty({
    description: '补签周期类型（1=按自然周；2=按自然月）。',
    example: CheckInMakeupPeriodTypeEnum.WEEKLY,
    enum: CheckInMakeupPeriodTypeEnum,
    validation: false,
  })
  makeupPeriodType!: CheckInMakeupPeriodTypeEnum

  @NumberProperty({
    description: '每周期系统发放的补签额度。',
    example: 2,
    validation: false,
  })
  periodicAllowance!: number

  @ArrayProperty({
    description: '默认基础奖励项。',
    itemClass: GrowthRewardItemDto,
    required: false,
    validation: false,
  })
  baseRewardItems?: GrowthRewardItemDto[] | null

  @ArrayProperty({
    description: '具体日期奖励规则列表。',
    itemClass: CheckInDateRewardRuleItemDto,
    validation: false,
  })
  dateRewardRules!: CheckInDateRewardRuleItemDto[]

  @ArrayProperty({
    description: '周期模式奖励规则列表。',
    itemClass: CheckInPatternRewardRuleItemDto,
    validation: false,
  })
  patternRewardRules!: CheckInPatternRewardRuleItemDto[]
}

export class UpdateCheckInStreakRoundDto {
  @StringProperty({
    description: '轮次编码。',
    example: 'default-round',
  })
  roundCode!: string

  @EnumProperty({
    description: '轮次状态（0=草稿；1=启用；2=归档）。',
    example: CheckInStreakRoundStatusEnum.ACTIVE,
    enum: CheckInStreakRoundStatusEnum,
  })
  status!: CheckInStreakRoundStatusEnum

  @EnumProperty({
    description:
      '下一轮切换策略（1=沿用当前轮规则；2=显式下一轮，当前启用接口由系统托管）。',
    example: CheckInStreakNextRoundStrategyEnum.INHERIT,
    enum: CheckInStreakNextRoundStrategyEnum,
  })
  nextRoundStrategy!: CheckInStreakNextRoundStrategyEnum

  @NumberProperty({
    description: '显式下一轮配置 ID（当前启用接口无需传入）。',
    example: 2,
    required: false,
    validation: false,
  })
  nextRoundConfigId?: number | null

  @ArrayProperty({
    description: '当前轮次奖励规则列表。',
    itemClass: CreateCheckInStreakRewardRuleDto,
  })
  rewardRules!: CreateCheckInStreakRewardRuleDto[]
}

export class CheckInStreakRoundDetailResponseDto extends BaseDto {
  @StringProperty({
    description: '轮次编码。',
    example: 'default-round',
    validation: false,
  })
  roundCode!: string

  @NumberProperty({
    description: '版本号。',
    example: 1,
    validation: false,
  })
  version!: number

  @EnumProperty({
    description: '轮次状态（0=草稿；1=启用；2=归档）。',
    example: CheckInStreakRoundStatusEnum.ACTIVE,
    enum: CheckInStreakRoundStatusEnum,
    validation: false,
  })
  status!: CheckInStreakRoundStatusEnum

  @EnumProperty({
    description: '下一轮切换策略（1=沿用当前轮规则；2=切换到显式下一轮）。',
    example: CheckInStreakNextRoundStrategyEnum.INHERIT,
    enum: CheckInStreakNextRoundStrategyEnum,
    validation: false,
  })
  nextRoundStrategy!: CheckInStreakNextRoundStrategyEnum

  @NumberProperty({
    description: '显式下一轮配置 ID。',
    example: 2,
    required: false,
    validation: false,
  })
  nextRoundConfigId?: number | null

  @ArrayProperty({
    description: '轮次奖励规则列表。',
    itemClass: CheckInStreakRewardRuleItemDto,
    validation: false,
  })
  rewardRules!: CheckInStreakRewardRuleItemDto[]
}
