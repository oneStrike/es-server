import {
  BooleanProperty,
  JsonProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 数据字典响应DTO
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
    description: '字典封面',
    example: 'https://example.com/cover.png',
    required: false,
    maxLength: 200,
  })
  cover?: string

  @BooleanProperty({
    description: '状态 true启用 false禁用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '备注信息',
    example: '用户状态字典',
    required: false,
    maxLength: 255,
  })
  description?: string
}

/**
 * 数据字典项响应DTO
 */
export class BaseDictionaryItemDto extends BaseDictionaryDto {
  @StringProperty({
    description: '字典编码',
    example: 'user_status',
    required: true,
    maxLength: 500,
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
) {
  @JsonProperty({
    description: '排序字段，json格式',
    example: "{id:'desc'}",
    required: false,
  })
  orderBy?: string
}
