import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { JsonProperty } from '@libs/platform/decorators/validate/json-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { IdDto } from '@libs/platform/dto/base.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION } from '../../event-definition/event-definition.doc';
import { GrowthAssetTypeEnum } from '../../growth-ledger/growth-ledger.constant'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'

export class BaseUserPointRecordDto extends IdDto {
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
    description: '资产类型（1=积分；2=经验）',
    example: GrowthAssetTypeEnum.POINTS,
    required: true,
    enum: GrowthAssetTypeEnum,
  })
  assetType!: GrowthAssetTypeEnum

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
    description: '变更值（正数为发放，负数为扣减）',
    example: 5,
    required: true,
  })
  delta!: number

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
    example: 'point:rule:ruleType=1|userId=1',
    required: true,
    maxLength: 120,
  })
  bizKey!: string

  @StringProperty({
    description: '账本来源（如 growth_rule、task_bonus、purchase）',
    example: 'growth_rule',
    required: false,
    maxLength: 40,
  })
  source?: string | null

  @StringProperty({
    description: '备注',
    example: '发表主题获得积分',
    required: false,
    maxLength: 500,
  })
  remark?: string | null

  @JsonProperty({
    description: '扩展上下文（仅返回白名单解释字段）',
    example: { exchangeId: 1, taskId: 9, assignmentId: 18 },
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

export class QueryUserPointRecordDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserPointRecordDto, ['ruleId', 'targetType', 'targetId'] as const),
  ),
) {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class AddUserPointsDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
  })
  userId!: number

  @EnumProperty({
    description: GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    enum: GrowthRuleTypeEnum,
  })
  ruleType!: GrowthRuleTypeEnum

  @StringProperty({
    description: '备注',
    example: '管理员发放积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class ConsumeUserPointsDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '扣减积分值',
    example: 20,
    required: true,
    min: 1,
  })
  points!: number

  @NumberProperty({
    description: '目标类型',
    example: 3,
    required: false,
  })
  targetType?: number

  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: false,
  })
  targetId?: number

  @NumberProperty({
    description: '兑换记录 ID',
    example: 1,
    required: false,
  })
  exchangeId?: number

  @StringProperty({
    description: '备注',
    example: '管理员扣减积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}
