import {
  ValidateArray,
  ValidateBoolean,
  ValidateNumber,
} from '@libs/base/decorators'
import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger'

/**
 * 去除的默认字段
 */
export const OMIT_BASE_FIELDS: (keyof BaseDto)[] = [
  'id',
  'createdAt',
  'updatedAt',
]

/**
 * ID DTO - 用于接收单个实体ID参数
 */
export class IdDto {
  @ValidateNumber({
    description: '主键id',
    example: 1,
    required: true,
  })
  id!: number
}

/**
 * IDs DTO - 用于接收多个实体ID参数
 */
export class IdsDto {
  @ValidateArray({
    description: '主键id集合',
    itemType: 'number',
    example: [1, 2, 3],
    required: true,
  })
  ids!: number[]
}

/**
 * 更新启用状态 DTO - 用于更新实体的启用/禁用状态
 */
export class UpdateEnabledStatusDto extends IdDto {
  @ValidateBoolean({
    description: '状态 true启用 false禁用',
    example: true,
    required: true,
  })
  isEnabled!: boolean
}

/**
 * 更新发布状态 DTO - 用于更新实体的发布/取消发布状态
 */
export class UpdatePublishedStatusDto extends IdDto {
  @ValidateBoolean({
    description: '发布状态 true发布 false取消发布',
    example: true,
    required: true,
  })
  isPublished!: boolean
}

/**
 * 批量操作响应 DTO - 用于返回批量操作的结果
 */
export class BatchOperationResponseDto {
  @ApiProperty({
    description: '操作成功的数据量',
    example: 1,
    type: Number,
  })
  count!: number
}

/**
 * 批量更新启用状态 DTO - 用于批量更新实体的启用/禁用状态
 */
export class BatchUpdateEnabledStatusDto extends IntersectionType(
  IdsDto,
  PickType(UpdateEnabledStatusDto, ['isEnabled']),
) {}

/**
 * 批量更新发布状态 DTO - 用于批量更新实体的发布/取消发布状态
 */
export class BatchUpdatePublishedStatusDto extends IntersectionType(
  IdsDto,
  PickType(UpdatePublishedStatusDto, ['isPublished']),
) {}

/**
 * 基础 DTO - 包含所有实体共有的基础字段
 */
export class BaseDto extends IdDto {
  @ApiProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt: Date

  @ApiProperty({
    description: '更新时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  updatedAt: Date
}
