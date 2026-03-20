import {
  BaseForumSectionDto,
  BaseForumTopicDto,
} from '@libs/forum'
import { BaseUserLevelRuleDto } from '@libs/growth'
import {
  ArrayProperty,
  DateProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import {
  IdDto,
  OMIT_BASE_FIELDS,
  PageDto,
} from '@libs/platform/dto'
import { BaseAppUserCountDto, BaseAppUserDto } from '@libs/user'
import {
  IntersectionType,
  OmitType,
  PartialType,
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

class AdminForumTopicUserCountDto extends PickType(BaseAppUserCountDto, [
  'forumTopicCount',
  'forumReplyCount',
  'forumReceivedLikeCount',
  'forumReceivedFavoriteCount',
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
  'signature',
  'bio',
  'isEnabled',
  'points',
  'levelId',
  'status',
  'banReason',
  'banUntil',
] as const) {
  @NestedProperty({
    description: '用户计数',
    required: false,
    type: AdminForumTopicUserCountDto,
    validation: false,
  })
  counts?: AdminForumTopicUserCountDto

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
  'auditAt',
  'viewCount',
  'replyCount',
  'likeCount',
  'commentCount',
  'favoriteCount',
  'version',
  'sensitiveWordHits',
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

export class CreateForumTopicDto extends OmitType(BaseForumTopicDto, [
  ...OMIT_BASE_FIELDS,
  'commentCount',
  'version',
  'sensitiveWordHits',
  'auditAt',
  'viewCount',
  'replyCount',
  'likeCount',
  'favoriteCount',
  'lastReplyUserId',
  'lastReplyAt',
  'auditStatus',
  'auditReason',
  'auditRole',
  'auditById',
  'isPinned',
  'isFeatured',
  'isLocked',
  'isHidden',
  'deletedAt',
] as const) {}

export class UpdateForumTopicDto extends IntersectionType(
  PartialType(PickType(BaseForumTopicDto, ['title', 'content'] as const)),
  IdDto,
) {}

export class QueryForumTopicDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumTopicDto, [
      'sectionId',
      'userId',
      'isPinned',
      'isFeatured',
      'isLocked',
      'isHidden',
      'auditStatus',
    ] as const),
  ),
) {
  @StringProperty({
    description: '关键词搜索（标题或内容）',
    example: 'TypeScript',
    required: false,
  })
  keyword?: string
}

export class UpdateForumTopicAuditStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['auditStatus', 'auditReason'] as const),
) {}

export class UpdateForumTopicPinnedDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isPinned'] as const),
) {}

export class UpdateForumTopicFeaturedDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isFeatured'] as const),
) {}

export class UpdateForumTopicLockedDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isLocked'] as const),
) {}

export class UpdateForumTopicHiddenDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isHidden'] as const),
) {}
