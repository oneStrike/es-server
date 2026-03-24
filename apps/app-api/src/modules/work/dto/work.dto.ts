import { BaseAuthorDto } from '@libs/content/author'
import { BaseCategoryDto } from '@libs/content/category'
import { BaseTagDto } from '@libs/content/tag'
import { BaseWorkChapterDto, BaseWorkDto } from '@libs/content/work'
import { BaseForumSectionDto } from '@libs/forum/section'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

class AuthorInfoDto extends PickType(BaseAuthorDto, [
  'id',
  'name',
  'type',
  'avatar',
]) {
  @BooleanProperty({
    description: '当前用户是否已关注该作者',
    example: true,
    required: false,
    validation: false,
  })
  isFollowed?: boolean
}

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
      'type',
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

export class QueryWorkTypeDto extends IntersectionType(
  PageDto,
  PickType(BaseWorkDto, ['type']),
) {}

export class WorkUserStatusFieldsDto {
  @BooleanProperty({
    description: '是否已点赞',
    example: true,
    required: true,
    validation: false,
  })
  liked!: boolean

  @BooleanProperty({
    description: '是否已收藏',
    example: false,
    required: true,
    validation: false,
  })
  favorited!: boolean

  @BooleanProperty({
    description: '是否已浏览',
    example: true,
    required: true,
    validation: false,
  })
  viewed!: boolean
}

export class ContinueReadingChapterDto extends PickType(BaseWorkChapterDto, [
  'id',
  'title',
  'subtitle',
  'sortOrder',
]) {}

export class WorkReadingStatusFieldsDto {
  @DateProperty({
    description: '最近阅读时间',
    example: '2026-03-09T10:00:00.000Z',
    required: false,
    validation: false,
  })
  lastReadAt?: Date

  @NestedProperty({
    description: '继续阅读章节',
    required: false,
    type: ContinueReadingChapterDto,
    validation: false,
  })
  continueChapter?: ContinueReadingChapterDto
}

class WorkDetailExtraDto extends PickType(BaseWorkDto, [
  'alias',
  'description',
  'originalSource',
  'copyright',
  'disclaimer',
  'remark',
  'lastUpdated',
  'viewRule',
  'requiredViewLevelId',
  'forumSectionId',
  'chapterPrice',
  'canComment',
  'recommendWeight',
  'viewCount',
  'favoriteCount',
  'likeCount',
  'commentCount',
  'downloadCount',
  'rating',
]) {}

class WorkDetailBodyDto extends IntersectionType(
  PageWorkDto,
  WorkDetailExtraDto,
) {}

export class WorkWithUserStatusDto extends IntersectionType(
  WorkDetailBodyDto,
  WorkUserStatusFieldsDto,
) {}

export class WorkDetailDto extends IntersectionType(
  WorkWithUserStatusDto,
  WorkReadingStatusFieldsDto,
) {}

class WorkForumSectionExtraDto {
  @NumberProperty({
    description: '可见主题数',
    example: 12,
    required: true,
    validation: false,
  })
  topicCount!: number

  @NumberProperty({
    description: '可见回复数',
    example: 58,
    required: true,
    validation: false,
  })
  replyCount!: number

  @NumberProperty({
    description: '关注人数',
    example: 35,
    required: true,
    validation: false,
  })
  followersCount!: number

  @DateProperty({
    description: '最后发帖时间',
    example: '2026-03-16T12:00:00.000Z',
    required: false,
    validation: false,
  })
  lastPostAt?: Date

  @BooleanProperty({
    description: '当前用户是否已关注该板块',
    example: true,
    required: false,
    validation: false,
  })
  isFollowed?: boolean
}

export class WorkForumSectionDto extends IntersectionType(
  PickType(BaseForumSectionDto, [
    'id',
    'name',
    'description',
    'icon',
    'isEnabled',
    'topicReviewPolicy',
  ]),
  WorkForumSectionExtraDto,
) {}

export class QueryWorkCommentPageDto extends IntersectionType(PageDto, IdDto) {}
