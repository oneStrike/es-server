import {
  ArrayProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto, UserIdDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION } from '../../event-definition/event-definition.constant'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'
import { GrowthRewardItemDto } from '../../reward-rule/dto/reward-item.dto'
import {
  GrowthRewardSettlementResultTypeEnum,
  GrowthRewardSettlementStatusEnum,
  GrowthRewardSettlementTypeEnum,
} from '../growth-reward.constant'

/** 通用成长事件 envelope 的补偿快照 DTO。 */
export class GrowthRewardSettlementEventEnvelopeSnapshotDto {
  @NumberProperty({
    description: '成长事件编码',
    example: GrowthRuleTypeEnum.TOPIC_LIKED,
    validation: false,
  })
  code!: number

  @StringProperty({
    description: '成长事件 key',
    example: 'TOPIC_LIKED',
    validation: false,
  })
  key!: string

  @StringProperty({
    description: '事件主体类型快照',
    example: 'user',
    validation: false,
  })
  subjectType!: string

  @NumberProperty({
    description: '事件主体 ID',
    example: 7,
    validation: false,
  })
  subjectId!: number

  @StringProperty({
    description: '事件目标类型快照',
    example: 'topic',
    validation: false,
  })
  targetType!: string

  @NumberProperty({
    description: '事件目标 ID',
    example: 99,
    validation: false,
  })
  targetId!: number

  @NumberProperty({
    description: '事件操作人 ID',
    example: 7,
    required: false,
    validation: false,
  })
  operatorId?: number

  @StringProperty({
    description: '事件发生时间 ISO 8601 快照',
    example: '2026-04-17T08:00:00.000Z',
    validation: false,
  })
  occurredAt!: string

  @StringProperty({
    description: '治理状态快照',
    example: 'passed',
    validation: false,
  })
  governanceStatus!: string

  @JsonProperty({
    description: '事件上下文快照 JSON',
    example: '{"topicId":99}',
    required: false,
    validation: false,
  })
  context?: Record<string, unknown>
}

/** 通用成长事件补偿重放载荷 DTO。 */
export class GrowthRewardSettlementGrowthEventPayloadDto {
  @NestedProperty({
    description: '通用成长事件 envelope 快照',
    type: GrowthRewardSettlementEventEnvelopeSnapshotDto,
    validation: false,
  })
  eventEnvelope!: GrowthRewardSettlementEventEnvelopeSnapshotDto

  @StringProperty({
    description: '奖励幂等业务键',
    example: 'like:3:99:user:7',
    validation: false,
  })
  bizKey!: string

  @StringProperty({
    description: '奖励来源',
    example: 'like',
    validation: false,
  })
  source!: string

  @StringProperty({
    description: '补充备注',
    example: '主题点赞触发成长奖励',
    required: false,
    validation: false,
  })
  remark?: string

  @NumberProperty({
    description: '目标类型',
    example: 3,
    required: false,
    validation: false,
  })
  targetType?: number

  @NumberProperty({
    description: '目标 ID',
    example: 99,
    required: false,
    validation: false,
  })
  targetId?: number

  @JsonProperty({
    description: '补充上下文 JSON',
    example: '{"likeSource":"topic_detail"}',
    required: false,
    validation: false,
  })
  context?: Record<string, unknown>
}

/** 任务奖励补偿重放载荷 DTO。 */
export class GrowthRewardSettlementTaskRewardPayloadDto {
  @StringProperty({
    description: '补偿载荷类型',
    example: 'task_reward',
    validation: false,
  })
  kind!: 'task_reward'

  @NumberProperty({
    description: '任务分配 ID',
    example: 88,
    validation: false,
  })
  assignmentId!: number

  @NumberProperty({
    description: '任务 ID',
    example: 18,
    validation: false,
  })
  taskId!: number

  @NumberProperty({
    description: '归属用户 ID',
    example: 10001,
    validation: false,
  })
  userId!: number

  @ArrayProperty({
    description: '任务奖励项快照',
    required: false,
    itemClass: GrowthRewardItemDto,
    validation: false,
    example: [
      { assetType: 1, amount: 10 },
      { assetType: 2, amount: 5 },
    ],
  })
  rewardItems?: GrowthRewardItemDto[] | null

  @StringProperty({
    description: '任务完成事件发生时间 ISO 8601 快照',
    example: '2026-04-17T08:00:00.000Z',
    validation: false,
  })
  occurredAt!: string
}

/** 签到基础奖励补偿重放载荷 DTO。 */
export class GrowthRewardSettlementCheckInRecordRewardPayloadDto {
  @StringProperty({
    description: '补偿载荷类型',
    example: 'check_in_record_reward',
    validation: false,
  })
  kind!: 'check_in_record_reward'

  @NumberProperty({
    description: '签到记录 ID',
    example: 501,
    validation: false,
  })
  recordId!: number

  @NumberProperty({
    description: '归属用户 ID',
    example: 10001,
    validation: false,
  })
  userId!: number

  @NumberProperty({
    description: '签到配置 ID',
    example: 12,
    validation: false,
  })
  configId!: number

  @StringProperty({
    description: '签到日期',
    example: '2026-04-17',
    validation: false,
  })
  signDate!: string

  @ArrayProperty({
    description: '签到基础奖励项快照',
    required: false,
    itemClass: GrowthRewardItemDto,
    validation: false,
    example: [{ assetType: 1, amount: 5 }],
  })
  rewardItems?: GrowthRewardItemDto[] | null
}

/** 连续签到奖励补偿重放载荷 DTO。 */
export class GrowthRewardSettlementCheckInStreakRewardPayloadDto {
  @StringProperty({
    description: '补偿载荷类型',
    example: 'check_in_streak_reward',
    validation: false,
  })
  kind!: 'check_in_streak_reward'

  @NumberProperty({
    description: '连续签到奖励发放记录 ID',
    example: 88,
    validation: false,
  })
  grantId!: number

  @NumberProperty({
    description: '归属用户 ID',
    example: 10001,
    validation: false,
  })
  userId!: number

  @NumberProperty({
    description: '连续签到规则 ID',
    example: 9,
    validation: false,
  })
  ruleId!: number

  @StringProperty({
    description: '连续签到规则编码',
    example: 'streak_7',
    validation: false,
  })
  ruleCode!: string

  @StringProperty({
    description: '触发奖励的签到日期',
    example: '2026-04-17',
    validation: false,
  })
  triggerSignDate!: string

  @ArrayProperty({
    description: '连续签到奖励项快照',
    required: false,
    itemClass: GrowthRewardItemDto,
    validation: false,
    example: [{ assetType: 2, amount: 7 }],
  })
  rewardItems?: GrowthRewardItemDto[] | null
}

/** 成长奖励补偿事实基础 DTO。 */
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
    description:
      '补偿记录类型（1=通用成长事件；2=任务奖励；3=签到基础奖励；4=签到连续奖励）',
    example: GrowthRewardSettlementTypeEnum.GROWTH_EVENT,
    enum: GrowthRewardSettlementTypeEnum,
    validation: false,
  })
  settlementType!: GrowthRewardSettlementTypeEnum

  @EnumProperty({
    description: GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION,
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
    description:
      '补偿重放用的原始载荷快照；通用成长事件、任务奖励、签到基础奖励、签到连续奖励会分别写入各自结构',
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
  requestPayload!:
    | GrowthRewardSettlementGrowthEventPayloadDto
    | GrowthRewardSettlementTaskRewardPayloadDto
    | GrowthRewardSettlementCheckInRecordRewardPayloadDto
    | GrowthRewardSettlementCheckInStreakRewardPayloadDto
}

/** 成长奖励补偿分页项 DTO。 */
export class GrowthRewardSettlementPageItemDto extends BaseGrowthRewardSettlementDto {}

/** 成长奖励补偿分页查询 DTO。 */
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

/** 批量补偿重试入参 DTO。 */
export class RetryGrowthRewardSettlementBatchDto {
  @NumberProperty({
    description: '本次最多扫描的待补偿记录数',
    example: 100,
    required: false,
    min: 1,
  })
  limit?: number
}

/** 批量补偿重试结果 DTO。 */
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
