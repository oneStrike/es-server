import {
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'

export class BaseUserPointRecordDto extends BaseDto {
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
    description: '关联兑换ID',
    example: 1,
    required: false,
  })
  exchangeId?: number

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
