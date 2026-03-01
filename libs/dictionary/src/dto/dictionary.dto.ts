import {
  BooleanProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

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
    maxLength: 50,
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
}

// ==================== 创建 DTO ====================

export class CreateDictionaryDto extends OmitType(BaseDictionaryDto, [
  'id',
  'createdAt',
  'updatedAt',
]) {}

export class CreateDictionaryItemDto extends OmitType(BaseDictionaryItemDto, [
  'id',
  'createdAt',
  'updatedAt',
]) {}

// ==================== 更新 DTO ====================

export class UpdateDictionaryDto extends OmitType(BaseDictionaryDto, [
  'createdAt',
  'updatedAt',
]) {}

export class UpdateDictionaryItemDto extends OmitType(BaseDictionaryItemDto, [
  'createdAt',
  'updatedAt',
]) {}

// ==================== 查询 DTO ====================

export class QueryDictionaryDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseDictionaryDto, ['name', 'code', 'isEnabled'])),
) {}

export class QueryDictionaryItemDto extends IntersectionType(
  PickType(BaseDictionaryItemDto, ['dictionaryCode']),
  PartialType(
    PickType(QueryDictionaryDto, [
      'name',
      'code',
      'isEnabled',
      'orderBy',
      'pageIndex',
      'pageSize',
    ]),
  ),
) {}
