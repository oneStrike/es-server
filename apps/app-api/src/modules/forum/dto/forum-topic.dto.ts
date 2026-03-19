import { BaseForumSectionDto, BaseForumTopicDto } from '@libs/forum'
import { NestedProperty } from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { BaseAppUserDto } from '@libs/user'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

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
  PartialType(PickType(BaseForumTopicDto, ['title', 'content'] as const)),
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
] as const) {}

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
