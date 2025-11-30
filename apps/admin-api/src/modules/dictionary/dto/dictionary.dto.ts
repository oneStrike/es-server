import { ValidateBoolean, ValidateString } from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  ApiProperty,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 数据字典响应DTO
 */
export class BaseDictionaryDto extends BaseDto {
  @ValidateString({
    description: '字典名称',
    example: '用户状态',
    required: true,
    maxLength: 50,
  })
  name!: string

  @ValidateString({
    description: '字典编码',
    example: 'user_status',
    required: true,
    maxLength: 50,
  })
  code!: string

  @ValidateString({
    description: '字典封面',
    example: 'https://example.com/cover.png',
    required: false,
    maxLength: 200,
  })
  cover?: string

  @ValidateBoolean({
    description: '状态 true启用 false禁用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @ValidateString({
    description: '备注信息',
    example: '用户状态字典',
    required: false,
    maxLength: 255,
  })
  description?: string

  @ApiProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date

  @ApiProperty({
    description: '更新时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: Date
}

/**
 * 数据字典项响应DTO
 */
export class BaseDictionaryItemDto extends BaseDictionaryDto {
  @ValidateString({
    description: '字典编码',
    example: 'user_status',
    required: true,
    maxLength: 50,
  })
  dictionaryCode!: string
}

export class UpdateDictionaryDto extends OmitType(BaseDictionaryDto, [
  'createdAt',
  'updatedAt',
]) {}

export class UpdateDictionaryItemDto extends OmitType(BaseDictionaryItemDto, [
  'createdAt',
  'updatedAt',
]) {}

export class CreateDictionaryItemDto extends OmitType(BaseDictionaryItemDto, [
  'id',
  'createdAt',
  'updatedAt',
]) {}

export class CreateDictionaryDto extends OmitType(BaseDictionaryDto, [
  'id',
  'createdAt',
  'updatedAt',
]) {}

export class QueryDictionaryDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseDictionaryDto, ['name', 'code', 'isEnabled'])),
) {}

export class QueryDictionaryItemDto extends IntersectionType(
  IntersectionType(
    PageDto,
    PartialType(PickType(BaseDictionaryDto, ['name', 'code', 'isEnabled'])),
  ),
  PickType(BaseDictionaryItemDto, ['dictionaryCode']),
) {}
