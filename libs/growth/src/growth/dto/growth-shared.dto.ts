import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import { IdDto, UserIdDto } from '@libs/platform/dto/base.dto'
import {
  GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION,
  GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION,
} from '../../event-definition/event-definition.constant'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'

export class BaseGrowthRuleConfigDto extends BaseDto {
  @EnumProperty({
    description: GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: GrowthRuleTypeEnum,
  })
  type!: GrowthRuleTypeEnum

  @NumberProperty({
    description: '每日上限（0=无限制）',
    example: 0,
    required: true,
    default: 0,
    min: 0,
  })
  dailyLimit!: number

  @NumberProperty({
    description: '总上限（0=无限制）',
    example: 0,
    required: true,
    default: 0,
    min: 0,
  })
  totalLimit!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '备注',
    example: '规则说明',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class BaseGrowthRecordSharedDto extends IdDto {
  @NumberProperty({
    description: '关联的用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '关联的规则ID',
    example: 1,
    required: false,
  })
  ruleId?: number | null

  @EnumProperty({
    description: GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    required: false,
    enum: GrowthRuleTypeEnum,
  })
  ruleType?: GrowthRuleTypeEnum | null

  @NumberProperty({
    description: '关联目标类型',
    example: 3,
    required: false,
  })
  targetType?: number | null

  @NumberProperty({
    description: '关联目标ID',
    example: 1,
    required: false,
  })
  targetId?: number | null

  @NumberProperty({
    description: '变更前余额',
    example: 100,
    required: true,
  })
  beforeValue!: number

  @NumberProperty({
    description: '变更后余额',
    example: 105,
    required: true,
  })
  afterValue!: number

  @StringProperty({
    description: '幂等业务键',
    example: 'growth:rule:ruleType=1|userId=1',
    required: true,
    maxLength: 120,
  })
  bizKey!: string

  @StringProperty({
    description: '账本说明文案',
    example: '浏览漫画作品',
    required: false,
    maxLength: 500,
  })
  remark?: string | null

  @JsonProperty({
    description: '扩展上下文（仅返回白名单解释字段）',
    example: { taskId: 9, assignmentId: 18 },
    required: false,
  })
  context?: Record<string, unknown> | null

  @DateProperty({
    description: '创建时间',
    example: '2026-03-19T12:00:00.000Z',
    required: true,
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2026-03-19T12:00:00.000Z',
    required: false,
  })
  updatedAt?: Date
}

export class UserGrowthRuleActionDto extends UserIdDto {
  @EnumProperty({
    description: GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    enum: GrowthRuleTypeEnum,
  })
  ruleType!: GrowthRuleTypeEnum

  @StringProperty({
    description: '内部操作备注，仅用于审计与排障，不会作为用户账本说明文案',
    example: '管理员补发奖励，保留原工单号',
    required: false,
    maxLength: 500,
  })
  operationNote?: string
}
