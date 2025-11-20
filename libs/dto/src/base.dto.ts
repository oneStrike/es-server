import {
  ValidateArray,
  ValidateBoolean,
  ValidateNumber,
} from '@libs/decorators'
import { ApiProperty } from '@nestjs/swagger'

export class IdDto {
  @ValidateNumber({
    description: '主键id',
    example: 1,
    required: true,
  })
  id!: number
}

export class IdsDto {
  @ValidateArray({
    description: '主键id集合',
    itemType: 'number',
    example: [1, 2, 3],
    required: true,
  })
  ids!: number[]
}

export class StatusDto {
  @ValidateBoolean({
    description: '状态 true启用 false禁用',
    example: true,
    required: true,
  })
  isEnabled!: boolean
}

export class PublishDto {
  @ValidateBoolean({
    description: '发布状态 true发布 false取消发布',
    example: true,
    required: true,
  })
  isPublished!: boolean
}

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
