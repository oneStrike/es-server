import {
  BooleanProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import {
  BaseDto,
  IdDto,
  OMIT_BASE_FIELDS,
  PageDto,
} from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 数据字典基础 DTO
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
    description: '字典封面图片 URL',
    example: 'https://example.com/cover.png',
    required: false,
    maxLength: 200,
  })
  cover?: string | null

  @BooleanProperty({
    description: '字典状态（true=启用；false=禁用）',
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
  description?: string | null
}

/**
 * 数据字典项基础 DTO
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
  sortOrder?: number | null

  @StringProperty({
    description: '字典项图标 URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 200,
  })
  cover?: string | null

  @BooleanProperty({
    description: '字典项状态（true=启用；false=禁用）',
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
  description?: string | null
}

export class CreateDictionaryDto extends OmitType(BaseDictionaryDto, [
  ...OMIT_BASE_FIELDS,
] as const) {}

export class UpdateDictionaryDto extends IntersectionType(
  IdDto,
  PartialType(CreateDictionaryDto),
) {}

export class QueryDictionaryDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseDictionaryDto, ['name', 'code', 'isEnabled'] as const),
  ),
) {}

export class CreateDictionaryItemDto extends OmitType(BaseDictionaryItemDto, [
  ...OMIT_BASE_FIELDS,
] as const) {}

export class UpdateDictionaryItemDto extends IntersectionType(
  IdDto,
  PartialType(CreateDictionaryItemDto),
) {}

export class QueryDictionaryItemDto extends IntersectionType(
  PickType(BaseDictionaryItemDto, ['dictionaryCode'] as const),
  PartialType(
    PickType(QueryDictionaryDto, [
      'name',
      'code',
      'isEnabled',
      'orderBy',
      'pageIndex',
      'pageSize',
    ] as const),
  ),
) {}

export class QueryAllDictionaryItemDto extends PickType(BaseDictionaryItemDto, [
  'dictionaryCode',
] as const) {}
