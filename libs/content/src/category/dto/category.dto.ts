import { ContentTypeEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import {
  BaseDto,
  DragReorderDto,
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
 * 分类基础 DTO
 */
export class BaseCategoryDto extends BaseDto {
  @StringProperty({
    description: '分类名称',
    example: '科幻',
    required: true,
    maxLength: 20,
  })
  name!: string

  @StringProperty({
    description: '分类图标 URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 255,
  })
  icon?: string | null

  @NumberProperty({
    description: '人气值',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  popularity!: number

  @NumberProperty({
    description: '排序值',
    example: 1,
    required: true,
    min: 0,
    max: 32767,
    default: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @ArrayProperty({
    description: '分类关联的内容类型（1=漫画；2=小说；3=帖子）',
    example: [ContentTypeEnum.COMIC],
    required: false,
    itemType: 'number',
    itemEnum: ContentTypeEnum,
  })
  contentType?: ContentTypeEnum[] | null

  @StringProperty({
    description: '分类描述',
    example: '科幻类分类',
    required: false,
    maxLength: 200,
  })
  description?: string | null
}

export class CreateCategoryDto extends OmitType(BaseCategoryDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
] as const) {}

export class UpdateCategoryDto extends IntersectionType(
  IdDto,
  PartialType(CreateCategoryDto),
) {}

export class QueryCategoryDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseCategoryDto, ['name', 'isEnabled'] as const)),
) {
  @JsonProperty({
    description: '分类关联的内容类型 JSON 字符串，例如 [1,2]',
    example: '[1,2]',
    required: false,
  })
  contentType?: string
}

export class UpdateCategoryStatusDto extends IntersectionType(
  PickType(BaseCategoryDto, ['isEnabled'] as const),
  IdDto,
) {}

export class UpdateCategorySortDto extends PickType(DragReorderDto, [
  'dragId',
  'targetId',
] as const) {}
