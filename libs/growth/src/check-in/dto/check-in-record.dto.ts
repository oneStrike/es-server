import { BaseGrowthRewardSettlementDto } from '@libs/growth/growth-reward/dto/growth-reward-settlement.dto'
import { GrowthRewardSettlementResultTypeEnum } from '@libs/growth/growth-reward/growth-reward.constant'
import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { JsonProperty } from '@libs/platform/decorators/validate/json-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { BaseDto } from '@libs/platform/dto/base.dto'
import { PickType } from '@nestjs/swagger'
import {
  CheckInOperatorTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRewardSourceTypeEnum,
} from '../check-in.constant'

export class BaseCheckInRecordDto extends BaseDto {
  @NumberProperty({
    description: '用户 ID。',
    example: 10001,
  })
  userId!: number

  @NumberProperty({
    description: '签到计划 ID。',
    example: 1,
  })
  planId!: number

  @NumberProperty({
    description: '周期实例 ID。',
    example: 12,
  })
  cycleId!: number

  @StringProperty({
    description: '签到日期（date 语义）。',
    example: '2026-04-01',
    type: 'ISO8601',
  })
  signDate!: string

  @EnumProperty({
    description: '签到类型（1=正常签到；2=补签）',
    example: CheckInRecordTypeEnum.NORMAL,
    enum: CheckInRecordTypeEnum,
  })
  recordType!: CheckInRecordTypeEnum

  @EnumProperty({
    description:
      '基础奖励来源（1=默认基础奖励；2=具体日期奖励；3=周期模式奖励）',
    example: CheckInRewardSourceTypeEnum.DATE_RULE,
    enum: CheckInRewardSourceTypeEnum,
    required: false,
    validation: false,
  })
  resolvedRewardSourceType?: CheckInRewardSourceTypeEnum | null

  @StringProperty({
    description:
      '本次基础奖励命中的规则键；命中默认基础奖励时为空。格式为 DATE:YYYY-MM-DD（具体日期）、WEEKDAY:n（按周星期）、MONTH_DAY:n（按月日期）或 MONTH_LAST_DAY（月末规则）。',
    example: 'DATE:2026-04-03',
    required: false,
    validation: false,
  })
  resolvedRewardRuleKey?: string | null

  @ArrayProperty({
    description:
      '本次基础奖励解析结果快照；来源可能是具体日期奖励、周期模式奖励或计划默认基础奖励，为空表示该签到事实没有基础奖励。',
    itemClass: GrowthRewardItemDto,
    example: [{ assetType: 1, amount: 10 }, { assetType: 2, amount: 5 }],
    required: false,
    validation: false,
  })
  resolvedRewardItems?: GrowthRewardItemDto[] | null

  @NumberProperty({
    description: '关联的奖励结算事实 ID。',
    example: 601,
    required: false,
    validation: false,
  })
  rewardSettlementId?: number | null

  @StringProperty({
    description: '业务幂等键；仅内部补偿、重试与排障使用。',
    example:
      'checkin:record:plan:1:cycle:week-2026-04-01:user:9:date:2026-04-03',
    maxLength: 180,
    contract: false,
  })
  bizKey!: string

  @EnumProperty({
    description:
      '操作来源类型（1=用户主动操作；2=管理员补偿或修复；3=系统任务补偿）',
    example: CheckInOperatorTypeEnum.USER,
    enum: CheckInOperatorTypeEnum,
  })
  operatorType!: CheckInOperatorTypeEnum

  @StringProperty({
    description: '备注；主要用于后台修复或排障说明。',
    example: '管理员补偿',
    required: false,
    maxLength: 500,
    validation: false,
  })
  remark?: string | null

  @JsonProperty({
    description: '签到上下文；用于保存排障或入口补充信息。',
    example: { source: 'app' },
    required: false,
    validation: false,
  })
  context?: Record<string, unknown> | null
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
