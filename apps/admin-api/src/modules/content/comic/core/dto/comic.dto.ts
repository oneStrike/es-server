import { BaseAuthorDto } from '@libs/content/author'
import { BaseCategoryDto } from '@libs/content/category'
import { BaseTagDto } from '@libs/content/tag'
import { BaseWorkDto } from '@libs/content/work'
import {
  ArrayProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateWorkDto extends OmitType(BaseWorkDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
  'viewCount',
  'favoriteCount',
  'likeCount',
  'commentCount',
  'downloadCount',
  'forumSectionId',
  'deletedAt',
]) {
  @ArrayProperty({
    description: '作者ID列表',
    itemType: 'number',
    example: [1],
    required: true,
  })
  authorIds!: number[]

  @ArrayProperty({
    description: '分类ID列表',
    itemType: 'number',
    example: [1],
    required: true,
  })
  categoryIds!: number[]

  @ArrayProperty({
    description: '标签ID列表',
    itemType: 'number',
    example: [1],
    required: true,
  })
  tagIds!: number[]
}

export class QueryWorkDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseWorkDto, [
      'name',
      'publisher',
      'isPublished',
      'serialStatus',
      'language',
      'region',
      'ageRating',
      'isRecommended',
      'isHot',
      'isNew',
    ]),
  ),
) {
  @StringProperty({ description: '作者名称', example: '村上', required: false })
  author?: string

  @NumberProperty({ description: '作者ID', example: 1, required: false })
  authorId?: number

  @ArrayProperty({
    description: '分类ID列表',
    itemType: 'number',
    example: [1],
    required: false,
  })
  categoryIds?: number[]

  @ArrayProperty({
    description: '标签ID列表',
    itemType: 'number',
    example: [1],
    required: false,
  })
  tagIds?: number[]
}

export class UpdateWorkDto extends IntersectionType(
  PartialType(CreateWorkDto),
  IdDto,
) {}

export class UpdateWorkStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isPublished']),
) {}

export class UpdateWorkRecommendedDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isRecommended']),
) {}

export class UpdateWorkHotDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isHot']),
) {}

export class UpdateWorkNewDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isNew']),
) {}

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
