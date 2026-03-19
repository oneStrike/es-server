import {
  BaseForumProfileDto,
  BaseForumSectionDto,
  BaseForumTopicDto,
} from '@libs/forum'
import { BaseUserLevelRuleDto } from '@libs/growth'
import {
  ArrayProperty,
  DateProperty,
  NestedProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { BaseAppUserDto } from '@libs/user'
import {
  PickType,
} from '@nestjs/swagger'

class AdminForumTopicTagRelationDto {
  @NumberProperty({
    description: '关联ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @NumberProperty({
    description: '主题ID',
    example: 1,
    required: true,
    validation: false,
  })
  topicId!: number

  @NumberProperty({
    description: '标签ID',
    example: 2,
    required: true,
    validation: false,
  })
  tagId!: number

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date
}

class AdminForumTopicSectionDto extends PickType(BaseForumSectionDto, [
  'id',
  'name',
  'description',
  'icon',
  'isEnabled',
  'topicReviewPolicy',
] as const) {}

class AdminForumTopicProfileDto extends PickType(BaseForumProfileDto, [
  'id',
  'userId',
  'points',
  'levelId',
  'signature',
  'bio',
  'status',
  'topicCount',
  'replyCount',
  'likeCount',
  'favoriteCount',
] as const) {}

class AdminForumTopicUserLevelDto extends PickType(BaseUserLevelRuleDto, [
  'id',
  'name',
  'icon',
  'sortOrder',
] as const) {}

class AdminForumTopicUserDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
  'isEnabled',
  'status',
] as const) {
  @NestedProperty({
    description: '论坛画像',
    required: false,
    type: AdminForumTopicProfileDto,
    validation: false,
  })
  forumProfile?: AdminForumTopicProfileDto

  @NestedProperty({
    description: '论坛等级',
    required: false,
    type: AdminForumTopicUserLevelDto,
    validation: false,
  })
  level?: AdminForumTopicUserLevelDto
}

export class AdminForumTopicDetailDto extends PickType(BaseForumTopicDto, [
  'id',
  'sectionId',
  'userId',
  'title',
  'content',
  'isPinned',
  'isFeatured',
  'isLocked',
  'isHidden',
  'auditStatus',
  'auditReason',
  'viewCount',
  'replyCount',
  'likeCount',
  'favoriteCount',
  'lastReplyAt',
  'lastReplyUserId',
  'createdAt',
  'updatedAt',
] as const) {
  @ArrayProperty({
    description: '主题标签关联',
    itemClass: AdminForumTopicTagRelationDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  topicTags!: AdminForumTopicTagRelationDto[]

  @NestedProperty({
    description: '所属板块',
    required: true,
    type: AdminForumTopicSectionDto,
    validation: false,
  })
  section!: AdminForumTopicSectionDto

  @NestedProperty({
    description: '发帖用户',
    required: true,
    type: AdminForumTopicUserDto,
    validation: false,
  })
  user!: AdminForumTopicUserDto
}
