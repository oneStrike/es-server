import { BaseForumSectionDto, BaseForumTopicDto } from '@libs/forum'
import { BooleanProperty, NestedProperty } from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { BaseAppUserDto } from '@libs/user'
import { IntersectionType, PickType } from '@nestjs/swagger'
import { TargetCommentItemDto } from '../../comment/dto/comment.dto'

export class QueryAppForumTopicPageDto extends IntersectionType(
  PageDto,
  PickType(BaseForumTopicDto, ['sectionId'] as const),
) {}

export class CreateAppForumTopicDto extends PickType(BaseForumTopicDto, [
  'sectionId',
  'title',
  'content',
] as const) {}

export class UpdateAppForumTopicDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['title', 'content'] as const),
) {}

export class AppForumSectionBriefDto extends PickType(BaseForumSectionDto, [
  'id',
  'name',
  'icon',
] as const) {}

export class AppForumTopicUserBriefDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) {}

export class AppForumTopicPageItemDto extends PickType(BaseForumTopicDto, [
  'id',
  'sectionId',
  'userId',
  'title',
  'isPinned',
  'isFeatured',
  'isLocked',
  'viewCount',
  'replyCount',
  'likeCount',
  'favoriteCount',
  'lastReplyAt',
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

export class AppForumTopicDetailDto extends IntersectionType(
  AppForumTopicPageItemDto,
  PickType(BaseForumTopicDto, ['content'] as const),
) {
  @NestedProperty({
    description: '所属板块',
    required: true,
    type: AppForumSectionBriefDto,
    validation: false,
  })
  section!: AppForumSectionBriefDto

  @NestedProperty({
    description: '发帖用户',
    required: true,
    type: AppForumTopicUserBriefDto,
    validation: false,
  })
  user!: AppForumTopicUserBriefDto
}

export class QueryForumTopicCommentPageDto extends IntersectionType(
  PageDto,
  IdDto,
) {}

export class ForumTopicCommentItemDto extends TargetCommentItemDto {}
