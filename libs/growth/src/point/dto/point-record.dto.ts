import {
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
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
    description: '资产类型',
    example: GrowthAssetTypeEnum.POINTS,
    required: true,
    enum: GrowthAssetTypeEnum,
  })
  assetType!: GrowthAssetTypeEnum

  @EnumProperty({
    description: '规则类型',
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
    description: '备注',
    example: '发表主题获得积分',
    required: false,
    maxLength: 500,
  })
  remark?: string | null

  @JsonProperty({
    description: '扩展上下文',
    example: { exchangeId: 1 },
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

export class UserPointRecordDto extends IdDto {
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
  ruleId?: number

  @NumberProperty({
    description: '关联目标类型',
    example: 3,
    required: false,
  })
  targetType?: number

  @NumberProperty({
    description: '关联目标ID',
    example: 1,
    required: false,
  })
  targetId?: number

  @NumberProperty({
    description: '积分变化（正数为获得，负数为消费）',
    example: 5,
    required: true,
  })
  points!: number

  @NumberProperty({
    description: '变化前积分',
    example: 100,
    required: true,
  })
  beforePoints!: number

  @NumberProperty({
    description: '变化后积分',
    example: 105,
    required: true,
  })
  afterPoints!: number

  @StringProperty({
    description: '备注',
    example: '发表主题获得积分',
    required: false,
    maxLength: 500,
  })
  remark?: string

  @DateProperty({
    description: '创建时间',
    example: '2026-03-19T12:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}

export class QueryUserPointRecordDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseUserPointRecordDto, ['ruleId'])),
) {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class AddUserPointsDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @EnumProperty({
    description: '规则类型',
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: GrowthRuleTypeEnum,
  })
  ruleType!: GrowthRuleTypeEnum

  @StringProperty({
    description: '备注',
    example: '发表主题获得积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class ConsumeUserPointsDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '消费积分数量',
    example: 10,
    required: true,
  })
  points!: number

  @NumberProperty({
    description: '关联目标类型',
    example: 3,
    required: false,
  })
  targetType?: number

  @NumberProperty({
    description: '关联目标ID',
    example: 1,
    required: false,
  })
  targetId?: number

  @NumberProperty({
    description: '关联兑换ID',
    example: 1,
    required: false,
  })
  exchangeId?: number

  @StringProperty({
    description: '备注',
    example: '管理员扣除积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}
