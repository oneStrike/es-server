import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { CheckInPatternRewardRuleTypeEnum } from '../check-in.constant'

class CheckInPatternRewardRuleFieldsDto {
  @EnumProperty({
    description:
      '周期模式类型（1=按周固定星期几；2=按月固定日期；3=按月最后一天）。',
    example: CheckInPatternRewardRuleTypeEnum.WEEKDAY,
    enum: CheckInPatternRewardRuleTypeEnum,
  })
  patternType!: CheckInPatternRewardRuleTypeEnum

  @NumberProperty({
    description: '按周固定星期几时使用，1=周一；7=周日。',
    example: 1,
    required: false,
    validation: false,
  })
  weekday?: number | null

  @NumberProperty({
    description: '按月固定日期时使用，1..31。',
    example: 15,
    required: false,
    validation: false,
  })
  monthDay?: number | null

  @ArrayProperty({
    description: '周期模式奖励项列表。',
    itemClass: GrowthRewardItemDto,
  })
  rewardItems!: GrowthRewardItemDto[]
}

export class CreateCheckInPatternRewardRuleDto extends CheckInPatternRewardRuleFieldsDto {}

export class CheckInPatternRewardRuleItemDto extends CheckInPatternRewardRuleFieldsDto {}
