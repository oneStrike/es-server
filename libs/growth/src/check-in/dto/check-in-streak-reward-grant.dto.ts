import {
  ArrayProperty,
  BooleanProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto } from '@libs/platform/dto'
import { CheckInRewardSettlementSummaryDto } from './check-in-record.dto'
import { CheckInRewardItemDto } from './check-in-reward-item.dto'

export class BaseCheckInStreakRewardGrantDto extends BaseDto {
  @NumberProperty({
    description: '连续奖励归属用户 ID。',
    example: 1,
    validation: false,
  })
  userId!: number

  @NumberProperty({
    description: '连续签到规则 ID。',
    example: 1,
    validation: false,
  })
  ruleId!: number

  @StringProperty({
    description: '连续奖励规则编码。',
    example: 'day-7',
    validation: false,
  })
  ruleCode!: string

  @NumberProperty({
    description: '命中的连续签到阈值。',
    example: 7,
    validation: false,
  })
  streakDays!: number

  @ArrayProperty({
    description: '冻结的连续奖励快照。',
    itemClass: CheckInRewardItemDto,
    validation: false,
  })
  rewardItems!: CheckInRewardItemDto[]

  @BooleanProperty({
    description: '是否允许重复发放。',
    example: false,
    validation: false,
  })
  repeatable!: boolean

  @StringProperty({
    description: '触发本次连续奖励的签到日期。',
    example: '2026-04-19',
    validation: false,
  })
  triggerSignDate!: string

  @NumberProperty({
    description: '关联的奖励补偿记录 ID。',
    example: 1,
    required: false,
    validation: false,
  })
  rewardSettlementId?: number | null
}

export class CheckInGrantItemDto extends BaseCheckInStreakRewardGrantDto {
  @NestedProperty({
    description: '连续奖励补偿摘要。',
    type: CheckInRewardSettlementSummaryDto,
    required: false,
    nullable: false,
    validation: false,
  })
  rewardSettlement?: CheckInRewardSettlementSummaryDto | null
}
