import {
  ArrayProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { CheckInPatternRewardRuleTypeEnum } from '../check-in.constant'
import { CheckInRewardItemDto } from './check-in-reward-item.dto'

export class BaseCheckInPatternRewardRuleDto {
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
    itemClass: CheckInRewardItemDto,
  })
  rewardItems!: CheckInRewardItemDto[]

  @StringProperty({
    description: '该周期奖励概览图标 URL。',
    example: 'https://cdn.example.com/check-in/pattern-overview.png',
    required: false,
    maxLength: 500,
  })
  rewardOverviewIconUrl?: string | null
}
