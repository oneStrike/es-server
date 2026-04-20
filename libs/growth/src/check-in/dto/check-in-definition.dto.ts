import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { BaseDto } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import {
  CheckInActivityStreakStatusEnum,
  CheckInDailyStreakConfigStatusEnum,
  CheckInDailyStreakPublishStrategyEnum,
  CheckInMakeupPeriodTypeEnum,
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

export class PublishCheckInDailyStreakConfigDto {
  @EnumProperty({
    description: '发布策略（1=立即生效；2=次日生效；3=指定时间生效）。',
    example: CheckInDailyStreakPublishStrategyEnum.NEXT_DAY,
    enum: CheckInDailyStreakPublishStrategyEnum,
  })
  publishStrategy!: CheckInDailyStreakPublishStrategyEnum

  @StringProperty({
    description: '指定生效时间；仅当发布策略需要明确时间点时传入。',
    example: '2026-04-20T00:00:00.000Z',
    required: false,
  })
  effectiveFrom?: string

  @ArrayProperty({
    description: '日常连续签到奖励规则列表。',
    itemClass: CreateCheckInStreakRewardRuleDto,
  })
  rewardRules!: CreateCheckInStreakRewardRuleDto[]
}

export class CheckInDailyStreakConfigDetailResponseDto extends BaseDto {
  @NumberProperty({
    description: '配置版本号。',
    example: 1,
    validation: false,
  })
  version!: number

  @EnumProperty({
    description: '配置状态（0=草稿；1=已排期；2=生效中；3=已过期；4=已终止）。',
    example: CheckInDailyStreakConfigStatusEnum.ACTIVE,
    enum: CheckInDailyStreakConfigStatusEnum,
    validation: false,
  })
  status!: CheckInDailyStreakConfigStatusEnum

  @EnumProperty({
    description: '发布策略（1=立即生效；2=次日生效；3=指定时间生效）。',
    example: CheckInDailyStreakPublishStrategyEnum.NEXT_DAY,
    enum: CheckInDailyStreakPublishStrategyEnum,
    validation: false,
  })
  publishStrategy!: CheckInDailyStreakPublishStrategyEnum

  @BooleanProperty({
    description: '是否为当前生效配置。',
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

  @ArrayProperty({
    description: '日常连续签到奖励规则列表。',
    itemClass: CheckInStreakRewardRuleItemDto,
    validation: false,
  })
  rewardRules!: CheckInStreakRewardRuleItemDto[]
}

export class QueryCheckInDailyStreakConfigHistoryPageDto extends PageDto {}

export class CheckInDailyStreakConfigHistoryPageItemDto extends CheckInDailyStreakConfigDetailResponseDto {}

export class CreateCheckInActivityStreakDto {
  @StringProperty({
    description: '活动稳定键。',
    example: 'summer-sign-in',
  })
  activityKey!: string

  @StringProperty({
    description: '活动标题。',
    example: '夏日连续签到',
  })
  title!: string

  @EnumProperty({
    description: '活动状态（0=草稿；1=已发布；2=已下线；3=已归档）。',
    example: CheckInActivityStreakStatusEnum.PUBLISHED,
    enum: CheckInActivityStreakStatusEnum,
  })
  status!: CheckInActivityStreakStatusEnum

  @StringProperty({
    description: '活动开始时间。',
    example: '2026-04-19T00:00:00.000Z',
  })
  effectiveFrom!: string

  @StringProperty({
    description: '活动结束时间。',
    example: '2026-04-26T23:59:59.999Z',
  })
  effectiveTo!: string

  @ArrayProperty({
    description: '活动连续签到奖励规则列表。',
    itemClass: CreateCheckInStreakRewardRuleDto,
  })
  rewardRules!: CreateCheckInStreakRewardRuleDto[]
}

export class UpdateCheckInActivityStreakDto extends CreateCheckInActivityStreakDto {
  @NumberProperty({
    description: '活动 ID。',
    example: 1,
  })
  id!: number
}

export class UpdateCheckInActivityStreakStatusDto {
  @NumberProperty({
    description: '活动 ID。',
    example: 1,
  })
  id!: number

  @EnumProperty({
    description: '活动状态（0=草稿；1=已发布；2=已下线；3=已归档）。',
    example: CheckInActivityStreakStatusEnum.DISABLED,
    enum: CheckInActivityStreakStatusEnum,
  })
  status!: CheckInActivityStreakStatusEnum
}

export class QueryCheckInActivityStreakPageDto extends PageDto {}

export class CheckInActivityStreakPageItemDto extends BaseDto {
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
}

export class CheckInActivityStreakDetailResponseDto extends CheckInActivityStreakPageItemDto {
  @ArrayProperty({
    description: '活动连续签到奖励规则列表。',
    itemClass: CheckInStreakRewardRuleItemDto,
    validation: false,
  })
  rewardRules!: CheckInStreakRewardRuleItemDto[]
}
