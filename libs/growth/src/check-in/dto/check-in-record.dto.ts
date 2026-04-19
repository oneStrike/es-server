import {
  GrowthRewardSettlementResultTypeEnum,
  GrowthRewardSettlementStatusEnum,
} from '@libs/growth/growth-reward/growth-reward.constant'
import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { BaseDto } from '@libs/platform/dto/base.dto'
import {
  CheckInRecordTypeEnum,
  CheckInRewardSourceTypeEnum,
} from '../check-in.constant'

export class BaseCheckInRecordDto extends BaseDto {
  @StringProperty({
    description: '签到自然日。',
    example: '2026-04-19',
    validation: false,
  })
  signDate!: string

  @EnumProperty({
    description: '签到类型（1=正常签到；2=补签）。',
    example: CheckInRecordTypeEnum.NORMAL,
    enum: CheckInRecordTypeEnum,
    validation: false,
  })
  recordType!: CheckInRecordTypeEnum

  @EnumProperty({
    description:
      '基础奖励解析来源（1=默认基础奖励；2=具体日期奖励；3=周期模式奖励）。',
    example: CheckInRewardSourceTypeEnum.DATE_RULE,
    enum: CheckInRewardSourceTypeEnum,
    required: false,
    validation: false,
  })
  resolvedRewardSourceType?: CheckInRewardSourceTypeEnum | null

  @StringProperty({
    description: '基础奖励命中的规则键。',
    example: 'DATE:2026-04-19',
    required: false,
    validation: false,
  })
  resolvedRewardRuleKey?: string | null

  @ArrayProperty({
    description: '冻结的基础奖励快照。',
    itemClass: GrowthRewardItemDto,
    required: false,
    validation: false,
  })
  resolvedRewardItems?: GrowthRewardItemDto[] | null

  @NumberProperty({
    description: '关联的奖励补偿记录 ID。',
    example: 1,
    required: false,
    validation: false,
  })
  rewardSettlementId?: number | null
}

export class CheckInRewardSettlementSummaryDto {
  @NumberProperty({
    description: '奖励补偿记录 ID。',
    example: 1,
    validation: false,
  })
  id!: number

  @EnumProperty({
    description: '补偿状态（0=待补偿重试；1=已补偿成功；2=终态失败）。',
    example: GrowthRewardSettlementStatusEnum.PENDING,
    enum: GrowthRewardSettlementStatusEnum,
    validation: false,
  })
  settlementStatus!: GrowthRewardSettlementStatusEnum

  @EnumProperty({
    description: '补偿结果类型（1=真实落账；2=命中幂等；3=处理失败）。',
    example: GrowthRewardSettlementResultTypeEnum.APPLIED,
    enum: GrowthRewardSettlementResultTypeEnum,
    required: false,
    validation: false,
  })
  settlementResultType?: GrowthRewardSettlementResultTypeEnum | null

  @ArrayProperty({
    description: '关联到账本记录 ID 列表。',
    itemType: 'number',
    validation: false,
  })
  ledgerRecordIds!: number[]

  @NumberProperty({
    description: '重试次数。',
    example: 0,
    validation: false,
  })
  retryCount!: number

  @StringProperty({
    description: '最近一次重试时间。',
    example: '2026-04-19T12:00:00.000Z',
    required: false,
    validation: false,
  })
  lastRetryAt?: string | Date | null

  @StringProperty({
    description: '最近一次落定时间。',
    example: '2026-04-19T12:00:00.000Z',
    required: false,
    validation: false,
  })
  settledAt?: string | Date | null

  @StringProperty({
    description: '最近一次失败原因。',
    example: '签到奖励发放失败',
    required: false,
    validation: false,
  })
  lastError?: string | null
}
