import type { CheckInRewardConfig } from '../check-in.type'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { JsonProperty } from '@libs/platform/decorators/validate/json-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { BaseDto } from '@libs/platform/dto/base.dto';
import {
  CheckInOperatorTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRewardResultTypeEnum,
  CheckInRewardSourceTypeEnum,
  CheckInRewardStatusEnum,
} from '../check-in.constant'
import { CheckInRewardConfigDto } from './check-in-reward-config.dto'

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
      '基础奖励状态（0=待处理；1=已成功；2=已失败）',
    example: CheckInRewardStatusEnum.PENDING,
    enum: CheckInRewardStatusEnum,
    required: false,
  })
  rewardStatus?: CheckInRewardStatusEnum | null

  @EnumProperty({
    description:
      '基础奖励结果类型（1=本次真实落账；2=命中幂等未重复落账；3=本次处理失败）',
    example: CheckInRewardResultTypeEnum.APPLIED,
    enum: CheckInRewardResultTypeEnum,
    required: false,
  })
  rewardResultType?: CheckInRewardResultTypeEnum | null

  @EnumProperty({
    description:
      '基础奖励来源（BASE_REWARD=默认基础奖励；DATE_RULE=日期奖励规则；PATTERN_RULE=周期模式奖励规则）',
    example: CheckInRewardSourceTypeEnum.DATE_RULE,
    enum: CheckInRewardSourceTypeEnum,
    required: false,
    validation: false,
  })
  resolvedRewardSourceType?: CheckInRewardSourceTypeEnum | null

  @StringProperty({
    description:
      '本次基础奖励命中的规则键；命中默认基础奖励时为空。DATE:YYYY-MM-DD / WEEKDAY:n / MONTH_DAY:n / MONTH_LAST_DAY。',
    example: 'DATE:2026-04-03',
    required: false,
    validation: false,
  })
  resolvedRewardRuleKey?: string | null

  @NestedProperty({
    description: '本次基础奖励解析结果快照；来源可能是具体日期奖励、周期模式奖励或计划默认基础奖励，为空表示该签到事实没有基础奖励。',
    type: CheckInRewardConfigDto,
    example: { points: 10, experience: 5 } satisfies CheckInRewardConfig,
    required: false,
    validation: false,
  })
  resolvedRewardConfig?: CheckInRewardConfigDto | null

  @StringProperty({
    description: '业务幂等键；仅内部补偿、重试与排障使用。',
    example: 'checkin:record:plan:1:cycle:week-2026-04-01:user:9:date:2026-04-03',
    maxLength: 180,
    contract: false,
  })
  bizKey!: string

  @ArrayProperty({
    description: '基础奖励账本记录 ID 列表。',
    itemType: 'number',
    example: [101, 102],
    validation: false,
  })
  baseRewardLedgerIds!: number[]

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

  @StringProperty({
    description: '最近一次基础奖励失败原因。',
    example: '签到基础奖励发放失败',
    required: false,
    maxLength: 500,
    validation: false,
  })
  lastRewardError?: string | null

  @JsonProperty({
    description: '签到上下文；用于保存排障或入口补充信息。',
    example: { source: 'app' },
    required: false,
    validation: false,
  })
  context?: Record<string, unknown> | null

  @DateProperty({
    description: '最近一次基础奖励结算时间。',
    example: '2026-04-01T00:01:00.000Z',
    required: false,
    validation: false,
  })
  rewardSettledAt?: Date | null
}
