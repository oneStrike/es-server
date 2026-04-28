import type { JsonValue } from '@libs/platform/utils'
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
import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'
import { BaseSensitiveWordHitDto } from '@libs/sensitive-word/dto/sensitive-word.dto'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  ForumHashtagCreateSourceTypeEnum,
  ForumHashtagCreationModeEnum,
} from '../forum-hashtag.constant'

/**
 * forum 话题基础 DTO。
 */
export class BaseForumHashtagDto extends BaseDto {
  @StringProperty({
    description: '归一化 slug',
    example: 'typescript',
    required: true,
    maxLength: 64,
  })
  slug!: string

  @StringProperty({
    description: '展示名称',
    example: 'TypeScript',
    required: true,
    maxLength: 64,
  })
  displayName!: string

  @StringProperty({
    description: '运营描述',
    example: '与 TypeScript 学习、实践和生态相关的话题',
    required: false,
    maxLength: 200,
  })
  description?: string | null

  @NumberProperty({
    description: '人工热度加权',
    example: 0,
    required: true,
    default: 0,
    validation: false,
  })
  manualBoost!: number

  @EnumProperty({
    description: '审核状态（0=待审核；1=已通过；2=已拒绝）',
    example: AuditStatusEnum.APPROVED,
    required: true,
    enum: AuditStatusEnum,
  })
  auditStatus!: AuditStatusEnum

  @BooleanProperty({
    description: '是否隐藏',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @NumberProperty({
    description: '审核人 ID',
    example: 1,
    required: false,
    min: 1,
  })
  auditById?: number | null

  @EnumProperty({
    description: '审核角色（0=版主；1=管理员）',
    example: AuditRoleEnum.ADMIN,
    enum: AuditRoleEnum,
    required: false,
  })
  auditRole?: AuditRoleEnum | null

  @StringProperty({
    description: '审核原因',
    example: '命中敏感词，需人工复核',
    required: false,
    maxLength: 500,
  })
  auditReason?: string | null

  @DateProperty({
    description: '审核时间',
    example: '2026-04-28T00:00:00.000Z',
    required: false,
    validation: false,
  })
  auditAt?: Date | null

  @EnumProperty({
    description:
      '创建来源（1=管理员创建；2=topic 正文自动创建；3=comment 正文自动创建）',
    example: ForumHashtagCreateSourceTypeEnum.ADMIN,
    required: true,
    enum: ForumHashtagCreateSourceTypeEnum,
    validation: false,
  })
  createSourceType!: ForumHashtagCreateSourceTypeEnum

  @NumberProperty({
    description: '创建该话题资源的用户 ID',
    example: 1,
    required: false,
    min: 1,
    validation: false,
  })
  createdByUserId?: number | null

  @ArrayProperty({
    description: '敏感词命中记录',
    itemClass: BaseSensitiveWordHitDto,
    required: false,
    validation: false,
  })
  sensitiveWordHits?: BaseSensitiveWordHitDto[] | null

  @NumberProperty({
    description: '可见主题引用数',
    example: 12,
    required: true,
    default: 0,
    validation: false,
  })
  topicRefCount!: number

  @NumberProperty({
    description: '可见评论引用数',
    example: 18,
    required: true,
    default: 0,
    validation: false,
  })
  commentRefCount!: number

  @NumberProperty({
    description: '关注人数',
    example: 7,
    required: true,
    default: 0,
    validation: false,
  })
  followerCount!: number

  @DateProperty({
    description: '最近一次被引用时间',
    example: '2026-04-28T00:00:00.000Z',
    required: false,
    validation: false,
  })
  lastReferencedAt?: Date | null
}

/**
 * forum 话题简要 DTO。
 */
export class ForumHashtagBriefDto extends PickType(BaseForumHashtagDto, [
  'id',
  'slug',
  'displayName',
  'description',
  'topicRefCount',
  'commentRefCount',
  'followerCount',
  'lastReferencedAt',
] as const) {}

/**
 * forum 话题公开详情 DTO。
 */
export class PublicForumHashtagDetailDto extends ForumHashtagBriefDto {
  @BooleanProperty({
    description: '当前用户是否已关注该话题',
    example: true,
    required: true,
    validation: false,
  })
  isFollowed!: boolean
}

/**
 * forum 话题热门分页项 DTO。
 */
export class PublicForumHashtagHotPageItemDto extends PublicForumHashtagDetailDto {
  @NumberProperty({
    description: '热门分值',
    example: 108,
    required: true,
    validation: false,
  })
  hotScore!: number
}

/**
 * forum 话题搜索项 DTO。
 */
export class PublicForumHashtagSearchItemDto extends ForumHashtagBriefDto {
  @BooleanProperty({
    description: '当前用户是否已关注该话题',
    example: true,
    required: true,
    validation: false,
  })
  isFollowed!: boolean
}

/**
 * forum 话题创建 DTO。
 */
export class CreateForumHashtagDto extends IntersectionType(
  PickType(BaseForumHashtagDto, ['displayName'] as const),
  PartialType(
    PickType(BaseForumHashtagDto, ['description', 'manualBoost'] as const),
  ),
) {}

/**
 * forum 话题更新 DTO。
 */
export class UpdateForumHashtagDto extends IntersectionType(
  IdDto,
  PartialType(
    PickType(BaseForumHashtagDto, ['description', 'manualBoost'] as const),
  ),
) {}

/**
 * forum 话题审核状态更新 DTO。
 */
export class UpdateForumHashtagAuditStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseForumHashtagDto, ['auditStatus', 'auditReason'] as const),
) {}

/**
 * forum 话题隐藏状态更新 DTO。
 */
export class UpdateForumHashtagHiddenDto extends IntersectionType(
  IdDto,
  PickType(BaseForumHashtagDto, ['isHidden'] as const),
) {}

/**
 * forum 话题后台分页查询 DTO。
 */
export class QueryForumHashtagDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumHashtagDto, ['auditStatus', 'isHidden'] as const),
  ),
) {
  @StringProperty({
    description: '关键词搜索（displayName 或 slug）',
    example: 'typescript',
    required: false,
    maxLength: 100,
  })
  keyword?: string
}

/**
 * forum 话题公开搜索 DTO。
 */
export class QueryPublicForumHashtagSearchDto {
  @StringProperty({
    description: '关键词搜索（displayName 或 slug）',
    example: 'typescript',
    required: true,
    minLength: 1,
    maxLength: 100,
  })
  keyword!: string

  @NumberProperty({
    description: '返回上限',
    example: 10,
    required: false,
    min: 1,
    validation: false,
  })
  limit?: number
}

/**
 * forum 话题公开热门分页 DTO。
 */
export class QueryPublicForumHashtagHotPageDto extends PageDto {}

/**
 * forum 话题关联主题分页 DTO。
 */
export class QueryForumHashtagTopicPageDto extends IntersectionType(
  IdDto,
  PageDto,
) {}

/**
 * forum 话题关联评论分页 DTO。
 */
export class QueryForumHashtagCommentPageDto extends IntersectionType(
  IdDto,
  PageDto,
) {}

/**
 * forum 话题创建模式 DTO。
 */
export class ForumHashtagCreationModeDto {
  @EnumProperty({
    description:
      '话题创建模式（1=仅引用已存在且可用话题；2=正文中允许自动创建话题）',
    required: true,
    enum: ForumHashtagCreationModeEnum,
    example: ForumHashtagCreationModeEnum.AUTO_CREATE,
  })
  creationMode!: ForumHashtagCreationModeEnum
}

/**
 * forum 话题评论分页项 DTO。
 */
export class ForumHashtagCommentPageItemDto {
  @NumberProperty({
    description: '评论 ID',
    example: 1,
    validation: false,
  })
  commentId!: number

  @NumberProperty({
    description: '主题 ID',
    example: 1,
    validation: false,
  })
  topicId!: number

  @StringProperty({
    description: '主题标题',
    example: 'TypeScript 泛型实践',
    validation: false,
  })
  topicTitle!: string

  @NumberProperty({
    description: '评论用户 ID',
    example: 1,
    validation: false,
  })
  userId!: number

  @JsonProperty({
    description: '评论 canonical 正文文档',
    required: true,
    validation: false,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '评论正文' }],
        },
      ],
    },
  })
  body!: JsonValue

  @StringProperty({
    description: '评论正文纯文本派生值',
    example: '#TypeScript 的类型推导太香了',
    validation: false,
  })
  content!: string

  @JsonProperty({
    description: '评论正文解析 token',
    required: false,
    validation: false,
    example: [{ type: 'text', text: '评论正文' }],
  })
  bodyTokens?: JsonValue | null

  @NumberProperty({
    description: '评论点赞数',
    example: 3,
    validation: false,
  })
  likeCount!: number

  @DateProperty({
    description: '评论创建时间',
    example: '2026-04-28T00:00:00.000Z',
    validation: false,
  })
  createdAt!: Date

  @NestedProperty({
    description: '评论用户',
    required: false,
    type: PickType(BaseAppUserDto, ['id', 'nickname', 'avatarUrl'] as const),
    validation: false,
    nullable: false,
  })
  user!: Pick<BaseAppUserDto, 'id' | 'nickname' | 'avatarUrl'>
}
