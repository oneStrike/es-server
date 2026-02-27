import { NumberProperty, StringProperty } from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

export class BaseUserBalanceRecordDto extends BaseDto {
  @NumberProperty({
    description: '关联的用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '变动金额',
    example: -100,
    required: true,
  })
  amount!: number

  @NumberProperty({
    description: '变动前余额',
    example: 500,
    required: true,
  })
  beforeBalance!: number

  @NumberProperty({
    description: '变动后余额',
    example: 400,
    required: true,
  })
  afterBalance!: number

  @NumberProperty({
    description: '类型',
    example: 1,
    required: true,
  })
  type!: number

  @StringProperty({
    description: '备注',
    example: '章节购买',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class ChangeUserBalanceDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '变动金额',
    example: -100,
    required: true,
  })
  amount!: number

  @NumberProperty({
    description: '类型',
    example: 1,
    required: true,
  })
  type!: number

  @StringProperty({
    description: '备注',
    example: '章节购买',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class QueryUserBalanceRecordDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseUserBalanceRecordDto, ['userId', 'type'])),
) {}
