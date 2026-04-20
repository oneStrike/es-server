import type { JsonValue } from '@libs/platform/utils'
import { BaseForumSectionDto } from '@libs/forum/section/dto/forum-section.dto'
import { BaseForumTagDto } from '@libs/forum/tag/dto/forum-tag.dto'
import { BaseUserLevelRuleDto } from '@libs/growth/level-rule/dto/level-rule.dto'
import {
  CommentOnlyAuthorDto,
  CommentSortDto,
} from '@libs/interaction/comment/dto/comment.dto'
import {
  MentionDraftDto,
  RequiredMentionDraftListDto,
} from '@libs/interaction/mention/dto/mention.dto'
import { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto, IdDto, PageDto, UserIdDto } from '@libs/platform/dto'

import { BaseSensitiveWordHitDto } from '@libs/sensitive-word/dto/sensitive-word.dto'
import { BaseAppUserCountDto } from '@libs/user/dto/base-app-user-count.dto'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

/**
 * 论坛主题基础 DTO。
 * 当前供 admin/app 控制器按字段组合复用。
 */
export class BaseForumTopicDto extends BaseDto {
  @StringProperty({
    description: '主题标题',
    example: '如何学习TypeScript？',
    required: true,
    maxLength: 200,
  })
  title!: string

  @StringProperty({
    description: '主题内容',
    example: '我想学习TypeScript，有什么好的学习资源推荐吗？',
    required: true,
  })
  content!: string

  @JsonProperty({
    description: '主题正文解析 token（表情与提及混合输出）',
    required: false,
    validation: false,
    example: [
      { type: 'text', text: '欢迎来到论坛 ' },
      {
        type: 'mentionUser',
        userId: 9,
        nickname: '测试用户',
        text: '@测试用户',
      },
      { type: 'emojiUnicode', unicodeSequence: '😀', emojiAssetId: 1001 },
    ],
  })
  bodyTokens?: JsonValue | null

  @ArrayProperty({
    description: '结构化提及列表，仅写入时使用',
    required: false,
    itemClass: MentionDraftDto,
    contract: false,
  })
  mentions?: MentionDraftDto[]

  @ArrayProperty({
    description: '主题图片列表',
    required: true,
    default: [],
    itemType: 'string',
    example: [
      '/files/forum/2026-03-25/image/topic-1.png',
      'https://cdn.example.com/forum/topic-2.jpg',
    ],
  })
  images!: string[]

  @ArrayProperty({
    description: '主题视频列表',
    required: true,
    default: [],
    itemType: 'string',
    example: ['https://cdn.example.com/forum/topic-1.mp4'],
  })
  videos!: string[]

  @NumberProperty({
    description: '关联的板块ID',
    example: 1,
    required: true,
    min: 1,
  })
  sectionId!: number

  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @BooleanProperty({
    description: '是否置顶',
    example: false,
    required: true,
    default: false,
  })
  isPinned!: boolean

  @BooleanProperty({
    description: '是否精华',
    example: false,
    required: true,
    default: false,
  })
  isFeatured!: boolean

  @BooleanProperty({
    description: '是否锁定',
    example: false,
    required: true,
    default: false,
  })
  isLocked!: boolean

  @BooleanProperty({
    description: '是否隐藏',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @EnumProperty({
    description: '审核角色（0=版主；1=管理员）',
    example: AuditRoleEnum.MODERATOR,
    required: false,
    enum: AuditRoleEnum,
    default: AuditRoleEnum.MODERATOR,
  })
  auditRole?: AuditRoleEnum

  @NumberProperty({
    description: '关联的审核用户ID',
    example: 1,
    required: false,
    min: 1,
  })
  auditById?: number

  @EnumProperty({
    description: '审核状态（0=待审核；1=已通过；2=已拒绝）',
    example: AuditStatusEnum.APPROVED,
    required: true,
    enum: AuditStatusEnum,
    default: AuditStatusEnum.APPROVED,
  })
  auditStatus!: AuditStatusEnum

  @StringProperty({
    description: '审核拒绝原因',
    example: '内容包含敏感信息',
    required: false,
    maxLength: 500,
  })
  auditReason?: string

  @DateProperty({
    description: '审核时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  auditAt?: Date

  @NumberProperty({
    description: '浏览次数',
    example: 100,
    required: true,
    default: 0,
    validation: false,
  })
  viewCount!: number

  @NumberProperty({
    description: '点赞次数',
    example: 5,
    required: true,
    default: 0,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '评论次数',
    example: 10,
    required: true,
    default: 0,
    validation: false,
  })
  commentCount!: number

  @NumberProperty({
    description: '收藏次数',
    example: 5,
    required: true,
    default: 0,
    validation: false,
  })
  favoriteCount!: number

  @NumberProperty({
    description: '乐观锁版本号',
    example: 0,
    required: true,
    default: 0,
    validation: false,
  })
  version!: number

  @ArrayProperty({
    description: '敏感词命中记录',
    itemClass: BaseSensitiveWordHitDto,
    required: false,
    validation: false,
  })
  sensitiveWordHits?: BaseSensitiveWordHitDto[]

  @StringProperty({
    description: '发帖时解析到的国家/地区',
    example: '中国',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoCountry?: string

  @StringProperty({
    description: '发帖时解析到的省份/州',
    example: '广东省',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoProvince?: string

  @StringProperty({
    description: '发帖时解析到的城市',
    example: '深圳市',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoCity?: string

  @StringProperty({
    description: '发帖时解析到的网络运营商',
    example: '电信',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoIsp?: string

  @StringProperty({
    description: '属地解析来源',
    example: 'ip2region',
    required: false,
    maxLength: 50,
    validation: false,
    contract: false,
  })
  geoSource?: string

  @DateProperty({
    description: '最后评论时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  lastCommentAt?: Date

  @NumberProperty({
    description: '最后评论用户ID',
    example: 2,
    required: false,
  })
  lastCommentUserId?: number

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

/**
 * 论坛主题可编辑字段 DTO。
 * 统一约束标题、正文和可选媒体列表，避免 app/admin 入口重复声明。
 */
export class ForumTopicWritableFieldsDto extends IntersectionType(
  PickType(BaseForumTopicDto, ['title', 'content'] as const),
  RequiredMentionDraftListDto,
  PartialType(PickType(BaseForumTopicDto, ['images', 'videos'] as const)),
) {}

export class CreateForumTopicDto extends IntersectionType(
  PickType(BaseForumTopicDto, ['sectionId', 'userId'] as const),
  ForumTopicWritableFieldsDto,
) {}

export class CreateUserForumTopicDto extends IntersectionType(
  PickType(BaseForumTopicDto, ['sectionId'] as const),
  ForumTopicWritableFieldsDto,
) {}

export class UpdateForumTopicDto extends IntersectionType(
  IdDto,
  ForumTopicWritableFieldsDto,
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

export class QueryPublicForumTopicDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumTopicDto, ['sectionId'] as const)),
) {}

export class QueryUserForumTopicDto extends IntersectionType(
  PageDto,
  PartialType(UserIdDto),
  PartialType(PickType(BaseForumTopicDto, ['sectionId'] as const)),
) {}

export class ForumTopicSectionBriefDto extends PickType(BaseForumSectionDto, [
  'id',
  'name',
  'icon',
  'cover',
] as const) {}

export class ForumTopicUserBriefDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) {}

export class PublicForumTopicDetailUserDto extends ForumTopicUserBriefDto {
  @BooleanProperty({
    description: '当前用户是否已关注发帖用户',
    example: true,
    required: true,
    validation: false,
  })
  isFollowed!: boolean
}

export class PublicForumTopicPageItemDto extends PickType(BaseForumTopicDto, [
  'id',
  'sectionId',
  'userId',
  'title',
  'geoCountry',
  'geoProvince',
  'geoCity',
  'geoIsp',
  'images',
  'videos',
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
  @StringProperty({
    description: '主题简要内容（正文前 60 个字符）',
    example: '我最近在整理一份入门 TypeScript 的学习路线，先从类型系统开始...',
    required: true,
    validation: false,
  })
  contentSnippet!: string

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

  @NestedProperty({
    description: '发帖用户',
    required: true,
    type: ForumTopicUserBriefDto,
    validation: false,
    nullable: false,
  })
  user!: ForumTopicUserBriefDto

  @NestedProperty({
    description: '所属板块',
    required: false,
    type: ForumTopicSectionBriefDto,
    validation: false,
    nullable: false,
  })
  section!: ForumTopicSectionBriefDto
}

export class ForumTopicTagItemDto extends PickType(BaseForumTagDto, [
  'id',
  'name',
  'icon',
] as const) {}

export class PublicForumTopicDetailDto extends IntersectionType(
  PickType(BaseForumTopicDto, [
    'id',
    'sectionId',
    'userId',
    'title',
    'content',
    'bodyTokens',
    'geoCountry',
    'geoProvince',
    'geoCity',
    'geoIsp',
    'images',
    'videos',
    'isPinned',
    'isFeatured',
    'isLocked',
    'viewCount',
    'commentCount',
    'likeCount',
    'favoriteCount',
    'lastCommentAt',
    'createdAt',
    'updatedAt',
  ] as const),
  PickType(PublicForumTopicPageItemDto, ['liked', 'favorited'] as const),
) {
  @NestedProperty({
    description: '发帖用户',
    required: true,
    type: PublicForumTopicDetailUserDto,
    validation: false,
  })
  user!: PublicForumTopicDetailUserDto

  @ArrayProperty({
    description: '标签',
    required: true,
    validation: false,
    itemClass: ForumTopicTagItemDto,
  })
  tags!: ForumTopicTagItemDto[]
}

export class UserForumTopicItemDto extends IntersectionType(
  PublicForumTopicPageItemDto,
  PickType(BaseForumTopicDto, ['auditStatus'] as const),
) {}

export class QueryForumTopicCommentPageDto extends IntersectionType(
  PageDto,
  IdDto,
  PartialType(CommentSortDto),
  PartialType(CommentOnlyAuthorDto),
) {}

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
  'cover',
  'isEnabled',
  'topicReviewPolicy',
] as const) {}

class AdminForumTopicUserCountDto extends PickType(BaseAppUserCountDto, [
  'commentCount',
  'likeCount',
  'favoriteCount',
  'forumTopicCount',
  'commentReceivedLikeCount',
  'forumTopicReceivedLikeCount',
  'forumTopicReceivedFavoriteCount',
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
    nullable: false,
  })
  counts!: AdminForumTopicUserCountDto

  @NestedProperty({
    description: '论坛等级',
    required: false,
    type: AdminForumTopicUserLevelDto,
    validation: false,
    nullable: false,
  })
  level!: AdminForumTopicUserLevelDto
}

export class AdminForumTopicDetailDto extends PickType(BaseForumTopicDto, [
  'id',
  'sectionId',
  'userId',
  'title',
  'content',
  'images',
  'videos',
  'isPinned',
  'isFeatured',
  'isLocked',
  'isHidden',
  'auditStatus',
  'auditReason',
  'auditAt',
  'viewCount',
  'likeCount',
  'commentCount',
  'favoriteCount',
  'version',
  'sensitiveWordHits',
  'lastCommentAt',
  'lastCommentUserId',
  'createdAt',
  'updatedAt',
] as const) {
  @ArrayProperty({
    description: '主题标签关联',
    itemClass: AdminForumTopicTagRelationDto,
    required: true,
    validation: false,
  })
  topicTags!: AdminForumTopicTagRelationDto[]

  @NestedProperty({
    description: '所属板块',
    required: true,
    type: AdminForumTopicSectionDto,
    validation: false,
    nullable: false,
  })
  section!: AdminForumTopicSectionDto

  @NestedProperty({
    description: '发帖用户',
    required: true,
    type: AdminForumTopicUserDto,
    validation: false,
    nullable: false,
  })
  user!: AdminForumTopicUserDto
}

export class AdminForumTopicPageItemDto extends PickType(BaseForumTopicDto, [
  'id',
  'sectionId',
  'userId',
  'title',
  'images',
  'videos',
  'isPinned',
  'isFeatured',
  'isLocked',
  'isHidden',
  'auditStatus',
  'auditReason',
  'auditAt',
  'viewCount',
  'likeCount',
  'commentCount',
  'favoriteCount',
  'lastCommentAt',
  'lastCommentUserId',
  'createdAt',
  'updatedAt',
] as const) {
  @StringProperty({
    description: '主题简要内容（正文前 60 个字符）',
    example: '我最近在整理一份入门 TypeScript 的学习路线，先从类型系统开始...',
    required: true,
    validation: false,
  })
  contentSnippet!: string
}
