import type { CheckInRewardConfig } from '../check-in.type'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { CheckInPatternRewardRuleTypeEnum } from '../check-in.constant'
import { CheckInRewardConfigDto } from './check-in-reward-config.dto'

class CheckInPatternRewardRuleFieldsDto {
  @EnumProperty({
    description:
      '周期模式类型（1=按周固定星期几；2=按月固定日期；3=按月最后一天）',
    example: CheckInPatternRewardRuleTypeEnum.WEEKDAY,
    enum: CheckInPatternRewardRuleTypeEnum,
  })
  patternType!: CheckInPatternRewardRuleTypeEnum

  @NumberProperty({
    description:
      '星期值；仅在“每周固定星期几”模式下填写（1=周一；2=周二；3=周三；4=周四；5=周五；6=周六；7=周日）。',
    example: 1,
    required: false,
    min: 1,
    max: 7,
  })
  weekday?: number | null

  @NumberProperty({
    description:
      '每月日期；仅在“每月固定几号”模式下填写，取值范围为 1..31。',
    example: 15,
    required: false,
    min: 1,
    max: 31,
  })
  monthDay?: number | null

  @NestedProperty({
    description: '命中后的基础奖励配置。',
    type: CheckInRewardConfigDto,
    example: { points: 10, experience: 5 } satisfies CheckInRewardConfig,
  })
  rewardConfig!: CheckInRewardConfigDto
}

export class CreateCheckInPatternRewardRuleDto extends CheckInPatternRewardRuleFieldsDto {}

export class CheckInPatternRewardRuleItemDto extends CheckInPatternRewardRuleFieldsDto {}
