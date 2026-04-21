import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { CheckInStreakConfigStatusEnum } from '../check-in.constant'

class CheckInStreakRewardRuleFieldsDto {
  @StringProperty({
    description: '连续奖励规则编码。',
    example: 'streak-day-7',
  })
  ruleCode!: string

  @NumberProperty({
    description: '命中奖励所需的连续签到天数。',
    example: 7,
    min: 1,
  })
  streakDays!: number

  @ArrayProperty({
    description: '连续奖励奖励项列表。',
    itemClass: GrowthRewardItemDto,
  })
  rewardItems!: GrowthRewardItemDto[]

  @BooleanProperty({
    description: '是否允许重复发放。',
    example: false,
    required: false,
  })
  repeatable?: boolean

  @EnumProperty({
    description: '记录状态（0=草稿；1=已排期；2=生效中；3=已过期；4=已终止）。',
    example: CheckInStreakConfigStatusEnum.ACTIVE,
    enum: CheckInStreakConfigStatusEnum,
    required: false,
  })
  status?: CheckInStreakConfigStatusEnum
}

export class CreateCheckInStreakRewardRuleDto extends CheckInStreakRewardRuleFieldsDto {}

export class CheckInStreakRewardRuleItemDto extends CheckInStreakRewardRuleFieldsDto {}
