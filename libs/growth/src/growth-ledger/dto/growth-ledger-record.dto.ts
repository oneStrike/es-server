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
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'
import { GrowthAssetTypeEnum } from '../growth-ledger.constant'

export class BaseGrowthLedgerRecordDto extends IdDto {
  @NumberProperty({
    description: '关联的用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @EnumProperty({
    description: '资产类型（1=积分；2=经验）',
    example: GrowthAssetTypeEnum.POINTS,
    required: true,
    enum: GrowthAssetTypeEnum,
  })
  assetType!: GrowthAssetTypeEnum

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
    example: 'task:complete:9:assignment:18:user:1:POINTS',
    required: true,
    maxLength: 120,
  })
  bizKey!: string

  @StringProperty({
    description: '账本来源（如 growth_rule、task_bonus、purchase）',
    example: 'task_bonus',
    required: true,
    maxLength: 40,
  })
  source!: string

  @StringProperty({
    description: '备注',
    example: '任务完成奖励（积分）',
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
}

export class QueryGrowthLedgerPageDto extends IntersectionType(
  PageDto,
  PickType(BaseGrowthLedgerRecordDto, ['userId'] as const),
  PartialType(
    PickType(BaseGrowthLedgerRecordDto, [
      'assetType',
      'ruleId',
      'ruleType',
      'targetType',
      'targetId',
    ] as const),
  ),
) {}
