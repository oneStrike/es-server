import { BaseWorkDto as ContentBaseWorkDto } from '@libs/content'
import { ArrayProperty, StringProperty } from '@libs/platform/decorators'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class BaseWorkDto extends ContentBaseWorkDto {}

export class CreateWorkDto extends OmitType(BaseWorkDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
  'viewCount',
  'favoriteCount',
  'likeCount',
  'commentCount',
  'downloadCount',
  'ratingCount',
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
