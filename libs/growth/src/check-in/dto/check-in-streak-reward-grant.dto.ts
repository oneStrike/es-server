import { ArrayProperty } from '@libs/platform/decorators/validate/array-property';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { JsonProperty } from '@libs/platform/decorators/validate/json-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { BaseDto } from '@libs/platform/dto/base.dto';
import { PickType } from '@nestjs/swagger'
import {
  CheckInRewardResultTypeEnum,
  CheckInRewardStatusEnum,
} from '../check-in.constant'

export class BaseCheckInStreakRewardGrantDto extends BaseDto {
  @NumberProperty({ description: '用户 ID。', example: 10001 })
  userId!: number

  @NumberProperty({ description: '签到计划 ID。', example: 1 })
  planId!: number

  @NumberProperty({ description: '周期实例 ID。', example: 12 })
  cycleId!: number

  @NumberProperty({ description: '连续奖励规则 ID。', example: 5 })
  ruleId!: number

  @StringProperty({
    description: '触发连续奖励的签到日期（date 语义）。',
    example: '2026-04-01',
    type: 'ISO8601',
  })
  triggerSignDate!: string

  @EnumProperty({
    description:
      '连续奖励发放状态（0=待处理，表示发放事实已创建但尚未结算；1=已成功；2=已失败）。',
    example: CheckInRewardStatusEnum.PENDING,
    enum: CheckInRewardStatusEnum,
  })
  grantStatus!: CheckInRewardStatusEnum

  @EnumProperty({
    description:
      '连续奖励发放结果类型（1=本次真实落账；2=命中幂等未重复落账；3=本次处理失败）。',
    example: CheckInRewardResultTypeEnum.APPLIED,
    enum: CheckInRewardResultTypeEnum,
    required: false,
  })
  grantResultType?: CheckInRewardResultTypeEnum | null

  @StringProperty({
    description: '业务幂等键；仅内部补偿、重试与排障使用。',
    example: 'checkin:grant:plan:1:rule:5:user:9:date:2026-04-03',
    maxLength: 200,
    contract: false,
  })
  bizKey!: string

  @ArrayProperty({
    description: '连续奖励账本记录 ID 列表。',
    itemType: 'number',
    example: [201],
    validation: false,
  })
  ledgerIds!: number[]

  @StringProperty({
    description: '最近一次连续奖励失败原因。',
    example: '连续奖励发放失败',
    required: false,
    maxLength: 500,
    validation: false,
  })
  lastGrantError?: string | null

  @NumberProperty({
    description: '发放事实对应的计划快照版本。',
    example: 1,
    validation: false,
  })
  planSnapshotVersion!: number

  @JsonProperty({
    description: '连续奖励上下文；用于保存命中来源或排障信息。',
    example: { triggeredByRecordId: 10 },
    required: false,
    validation: false,
  })
  context?: Record<string, unknown> | null

  @DateProperty({
    description: '最近一次连续奖励结算时间。',
    example: '2026-04-01T00:02:00.000Z',
    required: false,
    validation: false,
  })
  grantSettledAt?: Date | null
}

export class CheckInGrantItemDto extends PickType(
  BaseCheckInStreakRewardGrantDto,
  [
    'id',
    'ruleId',
    'triggerSignDate',
    'grantStatus',
    'grantResultType',
    'ledgerIds',
    'lastGrantError',
  ] as const,
) {}
