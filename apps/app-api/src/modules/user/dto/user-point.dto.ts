import { BaseUserPointRecordDto } from '@libs/growth/point'
import { NumberProperty } from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

/**
 * 查询我的积分记录 DTO
 *
 * 继承分页参数，并支持按规则ID、目标类型、目标ID筛选
 */
export class QueryMyPointRecordDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(
      BaseUserPointRecordDto,
      ['ruleId', 'targetType', 'targetId'] as const,
    ),
  ),
) {}

export class UserPointRecordDto extends PickType(BaseUserPointRecordDto, [
  'id',
  'userId',
  'ruleId',
  'ruleType',
  'targetType',
  'targetId',
  'bizKey',
  'remark',
  'context',
  'createdAt',
] as const) {
  @NumberProperty({
    description: '积分变化（正数为获得，负数为消费）',
    example: 5,
    validation: false,
  })
  points!: number

  @NumberProperty({
    description: '变化前积分',
    example: 100,
    validation: false,
  })
  beforePoints!: number

  @NumberProperty({
    description: '变化后积分',
    example: 105,
    validation: false,
  })
  afterPoints!: number
}
