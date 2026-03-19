import {
  BooleanProperty,
  DateProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'

// ==================== 基础响应 DTO ====================

/**
 * 数据字典响应 DTO
 * 字段顺序与数据库表保持一致
 */
export class BaseDictionaryDto extends BaseDto {
  @StringProperty({
    description: '字典名称',
    example: '用户状态',
    required: true,
    maxLength: 50,
  })
  name!: string

  @StringProperty({
    description: '字典编码',
    example: 'user_status',
    required: true,
    maxLength: 50,
  })
  code!: string

  @StringProperty({
    description: '字典封面图片URL',
    example: 'https://example.com/cover.png',
    required: false,
    maxLength: 200,
  })
  cover?: string

  @BooleanProperty({
    description: '字典状态：true=启用，false=禁用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '字典描述信息',
    example: '用户状态字典',
    required: false,
    maxLength: 255,
  })
  description?: string

  @DateProperty({
    description: '软删除时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}

/**
 * 数据字典项响应 DTO
 * 字段顺序与数据库表保持一致
 */
export class BaseDictionaryItemDto extends BaseDto {
  @StringProperty({
    description: '所属字典编码',
    example: 'user_status',
    required: true,
  })
  dictionaryCode!: string

  @StringProperty({
    description: '字典项名称',
    example: '正常',
    required: true,
    maxLength: 50,
  })
  name!: string

  @StringProperty({
    description: '字典项编码',
    example: 'normal',
    required: true,
    maxLength: 50,
  })
  code!: string

  @NumberProperty({
    description: '显示排序（数值越小越靠前）',
    example: 1,
    required: false,
  })
  sortOrder?: number

  @StringProperty({
    description: '字典项图标URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 200,
  })
  cover?: string

  @BooleanProperty({
    description: '字典项状态：true=启用，false=禁用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '字典项描述信息',
    example: '正常状态',
    required: false,
    maxLength: 255,
  })
  description?: string

  @DateProperty({
    description: '软删除时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}
