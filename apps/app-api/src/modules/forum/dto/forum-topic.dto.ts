import { BaseForumSectionDto } from '@libs/forum/section'
import { BaseForumTagDto } from '@libs/forum/tag'
import { BaseForumTopicDto } from '@libs/forum/topic'
import {
  ArrayProperty,
  BooleanProperty,
  NestedProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { BaseAppUserDto } from '@libs/user'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

export class QueryAppForumTopicPageDto extends IntersectionType(
  PageDto,
  PickType(BaseForumTopicDto, ['sectionId'] as const),
) { }

export class QueryMyForumTopicPageDto extends PartialType(QueryAppForumTopicPageDto) { }

export class CreateAppForumTopicDto extends PickType(BaseForumTopicDto, [
  'sectionId',
  'title',
  'content',
] as const) { }

export class UpdateAppForumTopicDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['title', 'content'] as const),
) { }

export class AppForumSectionBriefDto extends PickType(BaseForumSectionDto, [
  'id',
  'name',
  'icon',
] as const) { }

export class AppForumTopicUserBriefDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) { }

export class AppForumTopicPageItemDto extends PickType(BaseForumTopicDto, [
  'id',
  'sectionId',
  'userId',
  'title',
  'isPinned',
  'isFeatured',
  'isLocked',
  'viewCount',
  'commentCount',
  'likeCount',
  'favoriteCount',
  'lastCommentAt',
  'createdAt',
] as const) {
  @BooleanProperty({
    description: '当前用户是否已点赞',
    example: true,
    required: true,
    validation: false,
  })
  liked!: boolean

  @BooleanProperty({
    description: '当前用户是否已收藏',
    example: false,
    required: true,
    validation: false,
  })
  favorited!: boolean
}

export class ForumTopicTagItemDto extends PickType(BaseForumTagDto, [
  'id',
  'name',
  'icon',
] as const) { }

export class AppForumTopicDetailDto extends IntersectionType(
  BaseForumTopicDto,
  PickType(AppForumTopicPageItemDto, ['liked', 'favorited'] as const),
) {
  @NestedProperty({
    description: '发帖用户',
    required: true,
    type: AppForumTopicUserBriefDto,
    validation: false,
  })
  user!: AppForumTopicUserBriefDto

  @ArrayProperty({
    description: '标签',
    required: true,
    validation: false,
    itemClass: ForumTopicTagItemDto,
  })
  tags!: ForumTopicTagItemDto[]
}

export class QueryForumTopicCommentPageDto extends IntersectionType(
  PageDto,
  IdDto,
) { }

export class MyForumTopicSectionDto extends PickType(BaseForumSectionDto, [
  'id',
  'name',
] as const) { }

export class MyForumTopicItemDto extends PickType(BaseForumTopicDto, [
  'id',
  'sectionId',
  'title',
  'isPinned',
  'isFeatured',
  'isLocked',
  'viewCount',
  'commentCount',
  'likeCount',
  'favoriteCount',
  'lastCommentAt',
  'createdAt',
  'auditStatus',
] as const) {
  @NestedProperty({
    description: '所属板块',
    required: false,
    type: MyForumTopicSectionDto,
    validation: false,
    nullable: false,
  })
  section?: MyForumTopicSectionDto
}

