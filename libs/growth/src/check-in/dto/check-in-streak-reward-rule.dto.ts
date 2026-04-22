import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { CheckInStreakConfigStatusEnum } from '../check-in.constant'

export class BaseCheckInStreakRewardRuleDto {
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
