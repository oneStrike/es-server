import type { SerializedDispatchDefinedGrowthEventPayload } from '../growth-reward.types'
import {
  ArrayProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, PageDto, UserIdDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'
import {
  GrowthRewardSettlementResultTypeEnum,
  GrowthRewardSettlementStatusEnum,
  GrowthRewardSettlementTypeEnum,
} from '../growth-reward.constant'

export class BaseGrowthRewardSettlementDto extends BaseDto {
  @NumberProperty({
    description: '归属用户 ID',
    example: 10001,
    validation: false,
  })
  userId!: number

  @StringProperty({
    description: '奖励幂等业务键',
    example: 'like:3:99:user:7',
    maxLength: 160,
    validation: false,
  })
  bizKey!: string

  @EnumProperty({
    description: '补偿记录类型（1=通用成长事件；2=任务奖励）',
    example: GrowthRewardSettlementTypeEnum.GROWTH_EVENT,
    enum: GrowthRewardSettlementTypeEnum,
    validation: false,
  })
  settlementType!: GrowthRewardSettlementTypeEnum

  @EnumProperty({
    description:
      '成长事件编码（任务奖励可为空；1=发表主题；2=发表回复；3=主题被点赞；4=回复被点赞；5=主题被收藏；10=发表评论；11=评论被点赞；100=漫画作品浏览；101=漫画作品点赞；102=漫画作品收藏；200=小说作品浏览；201=小说作品点赞；202=小说作品收藏；700=关注用户；701=被关注；800=举报有效；801=举报无效）',
    example: GrowthRuleTypeEnum.TOPIC_LIKED,
    enum: GrowthRuleTypeEnum,
    required: false,
    validation: false,
  })
  eventCode?: GrowthRuleTypeEnum | null

  @StringProperty({
    description: '成长事件 key',
    example: 'TOPIC_LIKED',
    maxLength: 80,
    required: false,
    validation: false,
  })
  eventKey?: string | null

  @StringProperty({
    description: '奖励来源',
    example: 'like',
    maxLength: 40,
    validation: false,
  })
  source!: string

  @NumberProperty({
    description: '来源事实主键（任务奖励通常为 assignmentId）',
    example: 88,
    required: false,
    validation: false,
  })
  sourceRecordId?: number | null

  @NumberProperty({
    description: '目标类型',
    example: 3,
    required: false,
    validation: false,
  })
  targetType?: number | null

  @NumberProperty({
    description: '目标 ID',
    example: 99,
    required: false,
    validation: false,
  })
  targetId?: number | null

  @DateProperty({
    description: '原始事件发生时间',
    example: '2026-04-17T08:00:00.000Z',
    validation: false,
  })
  eventOccurredAt!: Date

  @EnumProperty({
    description: '补偿状态（0=待补偿重试；1=已补偿成功；2=终态失败）',
    example: GrowthRewardSettlementStatusEnum.PENDING,
    enum: GrowthRewardSettlementStatusEnum,
    validation: false,
  })
  settlementStatus!: GrowthRewardSettlementStatusEnum

  @EnumProperty({
    description:
      '补偿结果类型（1=本次真实落账；2=命中幂等未重复落账；3=本次处理失败）',
    example: GrowthRewardSettlementResultTypeEnum.APPLIED,
    enum: GrowthRewardSettlementResultTypeEnum,
    required: false,
    validation: false,
  })
  settlementResultType?: GrowthRewardSettlementResultTypeEnum | null

  @ArrayProperty({
    description: '本次补偿关联到账本记录 ID 列表',
    itemType: 'number',
    required: true,
    validation: false,
    example: [101, 102],
  })
  ledgerRecordIds!: number[]

  @NumberProperty({
    description: '已执行的补偿重试次数',
    example: 2,
    validation: false,
  })
  retryCount!: number

  @DateProperty({
    description: '最近一次重试时间',
    example: '2026-04-17T08:10:00.000Z',
    required: false,
    validation: false,
  })
  lastRetryAt?: Date | null

  @DateProperty({
    description: '最近一次补偿状态落定时间',
    example: '2026-04-17T08:12:00.000Z',
    required: false,
    validation: false,
  })
  settledAt?: Date | null

  @StringProperty({
    description: '最近一次失败原因',
    example: '数据库事务失败',
    required: false,
    maxLength: 500,
    validation: false,
  })
  lastError?: string | null

  @JsonProperty({
    description: '补偿重放用的原始派发载荷快照',
    example: {
      bizKey: 'like:3:99:user:7',
      source: 'like',
      eventEnvelope: {
        code: 3,
        key: 'TOPIC_LIKED',
      },
    },
    validation: false,
  })
  requestPayload!: SerializedDispatchDefinedGrowthEventPayload
}

export class GrowthRewardSettlementPageItemDto extends BaseGrowthRewardSettlementDto {}

export class QueryGrowthRewardSettlementPageDto extends IntersectionType(
  PageDto,
  PartialType(
    IntersectionType(
      UserIdDto,
      PickType(BaseGrowthRewardSettlementDto, [
        'settlementType',
        'eventCode',
        'settlementStatus',
      ] as const),
    ),
  ),
) {}

export class RetryGrowthRewardSettlementDto extends IdDto {}

export class RetryGrowthRewardSettlementBatchDto {
  @NumberProperty({
    description: '本次最多扫描的待补偿记录数',
    example: 100,
    required: false,
    min: 1,
  })
  limit?: number
}

export class GrowthRewardSettlementRetryBatchResultDto {
  @NumberProperty({
    description: '本次扫描到的补偿记录数',
    example: 12,
    validation: false,
  })
  scannedCount!: number

  @NumberProperty({
    description: '本次补偿成功数',
    example: 10,
    validation: false,
  })
  succeededCount!: number

  @NumberProperty({
    description: '本次补偿后仍未成功的记录数',
    example: 2,
    validation: false,
  })
  failedCount!: number
}
