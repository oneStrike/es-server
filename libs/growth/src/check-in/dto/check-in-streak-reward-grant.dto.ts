import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { BaseDto } from '@libs/platform/dto/base.dto'
import { CheckInRewardSettlementSummaryDto } from './check-in-record.dto'

export class BaseCheckInStreakRewardGrantDto extends BaseDto {
  @NumberProperty({
    description: '连续奖励归属用户 ID。',
    example: 1,
    validation: false,
  })
  userId!: number

  @NumberProperty({
    description: '连续签到配置 ID。',
    example: 1,
    validation: false,
  })
  configId!: number

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
    itemClass: GrowthRewardItemDto,
    validation: false,
  })
  rewardItems!: GrowthRewardItemDto[]

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
