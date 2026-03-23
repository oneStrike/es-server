import { BaseCategoryDto as ContentBaseCategoryDto } from '@libs/content/category'
import { JsonProperty } from '@libs/platform/decorators'
import { DragReorderDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class BaseCategoryDto extends ContentBaseCategoryDto {}

export class CreateCategoryDto extends OmitType(BaseCategoryDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
] as const) {}

export class UpdateCategoryDto extends IntersectionType(CreateCategoryDto, IdDto) {}

export class QueryCategoryDto extends IntersectionType(
  PageDto,
  PartialType(PickType(CreateCategoryDto, ['name', 'isEnabled'] as const)),
) {
  @JsonProperty({
    description: '分类关联的内容类型',
    example: '[1]',
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
