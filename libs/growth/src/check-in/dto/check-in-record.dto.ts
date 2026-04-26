import { BaseGrowthRewardSettlementDto } from '@libs/growth/growth-reward/dto/growth-reward-settlement.dto'
import {
  ArrayProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto } from '@libs/platform/dto'
import { PickType } from '@nestjs/swagger'
import {
  CheckInRecordTypeEnum,
  CheckInRewardSourceTypeEnum,
} from '../check-in.constant'
import { CheckInRewardItemDto } from './check-in-reward-item.dto'

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
    itemClass: CheckInRewardItemDto,
    required: false,
    validation: false,
  })
  resolvedRewardItems?: CheckInRewardItemDto[] | null

  @StringProperty({
    description: '冻结的基础奖励概览图标 URL。',
    example: 'https://cdn.example.com/check-in/reward-overview.png',
    required: false,
    validation: false,
  })
  resolvedRewardOverviewIconUrl?: string | null

  @StringProperty({
    description: '冻结的补签图标 URL；普通签到时为空。',
    example: 'https://cdn.example.com/check-in/makeup.png',
    required: false,
    validation: false,
  })
  resolvedMakeupIconUrl?: string | null

  @NumberProperty({
    description: '关联的奖励补偿记录 ID。',
    example: 1,
    required: false,
    validation: false,
  })
  rewardSettlementId?: number | null
}

export class CheckInRewardSettlementSummaryDto extends PickType(
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
) {}
