import { BaseGrowthRewardSettlementDto } from '@libs/growth/growth-reward/dto/growth-reward-settlement.dto'
import { GrowthRewardSettlementResultTypeEnum } from '@libs/growth/growth-reward/growth-reward.constant'
import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { JsonProperty } from '@libs/platform/decorators/validate/json-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { BaseDto } from '@libs/platform/dto/base.dto'
import { PickType } from '@nestjs/swagger'

class CheckInRewardSettlementSummaryDto extends PickType(
  BaseGrowthRewardSettlementDto,
  [
    'id',
    'settlementStatus',
    'settlementResultType',
    'ledgerRecordIds',
    'retryCount',
    'lastRetryAt',
    'settledAt',
    'lastError',
  ] as const,
) {
  @EnumProperty({
    description:
      '补偿结果类型（1=本次真实落账；2=命中幂等未重复落账；3=本次处理失败）',
    example: GrowthRewardSettlementResultTypeEnum.APPLIED,
    enum: GrowthRewardSettlementResultTypeEnum,
    required: false,
    validation: false,
  })
  settlementResultType?: GrowthRewardSettlementResultTypeEnum | null
}

export class BaseCheckInStreakRewardGrantDto extends BaseDto {
  @NumberProperty({ description: '用户 ID。', example: 10001 })
  userId!: number

  @NumberProperty({ description: '签到计划 ID。', example: 1 })
  planId!: number

  @NumberProperty({ description: '周期实例 ID。', example: 12 })
  cycleId!: number

  @StringProperty({ description: '连续奖励规则编码。', example: 'streak-7' })
  ruleCode!: string

  @NumberProperty({ description: '连续签到阈值天数。', example: 7 })
  streakDays!: number

  @ArrayProperty({
    description: '连续奖励项快照。',
    itemClass: GrowthRewardItemDto,
    example: [{ assetType: 1, amount: 70 }],
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
    description: '触发连续奖励的签到日期（date 语义）。',
    example: '2026-04-01',
    type: 'ISO8601',
  })
  triggerSignDate!: string

  @NumberProperty({
    description: '关联的奖励结算事实 ID。',
    example: 701,
    required: false,
    validation: false,
  })
  rewardSettlementId?: number | null

  @StringProperty({
    description: '业务幂等键；仅内部补偿、重试与排障使用。',
    example:
      'checkin:grant:plan:1:cycle:12:rule:streak-7:user:9:date:2026-04-03',
    maxLength: 200,
    contract: false,
  })
  bizKey!: string

  @JsonProperty({
    description: '连续奖励上下文；用于保存命中来源或排障信息。',
    example: { triggeredByRecordId: 10 },
    required: false,
    validation: false,
  })
  context?: Record<string, unknown> | null
}

export class CheckInGrantItemDto extends PickType(
  BaseCheckInStreakRewardGrantDto,
  [
    'id',
    'ruleCode',
    'streakDays',
    'rewardItems',
    'triggerSignDate',
    'rewardSettlementId',
  ] as const,
) {
  @NestedProperty({
    description: '连续奖励结算摘要。',
    type: CheckInRewardSettlementSummaryDto,
    required: false,
    nullable: false,
    validation: false,
  })
  rewardSettlement?: CheckInRewardSettlementSummaryDto | null
}
