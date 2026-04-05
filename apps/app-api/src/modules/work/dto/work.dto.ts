import { BaseAuthorDto } from '@libs/content/author'
import { BaseCategoryDto } from '@libs/content/category'
import { BaseTagDto } from '@libs/content/tag'
import { BaseWorkChapterDto, BaseWorkDto } from '@libs/content/work'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  NestedProperty,
} from '@libs/platform/decorators'
import { IntersectionType, PickType } from '@nestjs/swagger'

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
