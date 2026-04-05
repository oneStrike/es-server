import { BaseAuthorDto } from '@libs/content/author'
import { BaseCategoryDto } from '@libs/content/category'
import { BaseTagDto } from '@libs/content/tag'
import { BaseWorkDto } from '@libs/content/work'
import {
  ArrayProperty,
} from '@libs/platform/decorators'
import { PickType } from '@nestjs/swagger'

class AuthorInfoDto extends PickType(BaseAuthorDto, [
  'id',
  'name',
  'type',
  'avatar',
]) {}

class CategoryInfoDto extends PickType(BaseCategoryDto, [
  'id',
  'name',
  'icon',
]) {}

class TagInfoDto extends PickType(BaseTagDto, ['id', 'name', 'icon']) {}

export class PageWorkDto extends PickType(BaseWorkDto, [
  'id',
  'name',
  'type',
  'cover',
  'popularity',
  'isRecommended',
  'isHot',
  'isNew',
  'serialStatus',
  'publisher',
  'language',
  'region',
  'ageRating',
  'createdAt',
  'updatedAt',
  'publishAt',
  'isPublished',
]) {
  @ArrayProperty({
    description: '作者列表',
    itemClass: AuthorInfoDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  authors!: AuthorInfoDto[]

  @ArrayProperty({
    description: '分类列表',
    itemClass: CategoryInfoDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  categories!: CategoryInfoDto[]

  @ArrayProperty({
    description: '标签列表',
    itemClass: TagInfoDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  tags!: TagInfoDto[]
}
