import { BaseForumSectionGroupDto } from '@libs/forum/section-group/dto/forum-section-group.dto'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { DateProperty } from '@libs/platform/decorators/validate/date-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import {
  BaseDto,
  IdDto,
  OMIT_BASE_FIELDS,
  UserIdDto,
} from '@libs/platform/dto/base.dto'
import { DragReorderDto } from '@libs/platform/dto/drag-reorder.dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { ForumReviewPolicyEnum } from '../../forum.constant'

/**
 * 论坛板块基础 DTO。
 * 当前供应用侧按字段组合复用。
 */
export class BaseForumSectionDto extends BaseDto {
  @StringProperty({
    description: '板块名称',
    example: '技术交流',
    required: true,
    maxLength: 100,
  })
  name!: string

  @NumberProperty({
    description: '板块分组ID（为空表示未分组）',
    example: 1,
    required: false,
    min: 1,
  })
  groupId?: number

  @NumberProperty({
    description: '用户等级规则ID（为空表示所有用户）',
    example: 1,
    required: false,
    min: 1,
  })
  userLevelRuleId?: number | null

  @NumberProperty({
    description: '最后发表主题ID',
    example: 100,
    required: false,
    min: 1,
  })
  lastTopicId?: number | null

  @StringProperty({
    description: '板块图标',
    example: 'https://example.com/icon.png',
    required: true,
    maxLength: 500,
  })
  icon!: string

  @StringProperty({
    description: '板块封面',
    example: 'https://example.com/cover.png',
    required: true,
    maxLength: 500,
  })
  cover!: string

  @NumberProperty({
    description: '排序权重',
    example: 0,
    required: true,
    min: 0,
    default: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @EnumProperty({
    description:
      '审核策略（0=不审核；1=严重敏感词触发审核；2=一般敏感词触发审核；3=轻度敏感词触发审核；4=强制人工审核）',
    example: ForumReviewPolicyEnum.NONE,
    required: true,
    default: ForumReviewPolicyEnum.SEVERE_SENSITIVE_WORD,
    enum: ForumReviewPolicyEnum,
  })
  topicReviewPolicy!: ForumReviewPolicyEnum

  @StringProperty({
    description: '板块描述',
    example: '讨论技术相关问题',
    required: false,
    maxLength: 500,
  })
  description?: string | null

  @StringProperty({
    description: '备注信息',
    example: '仅管理员可见',
    required: false,
    maxLength: 500,
  })
  remark?: string | null

  @NumberProperty({
    description: '主题数',
    example: 120,
    required: true,
    default: 0,
    validation: false,
  })
  topicCount!: number

  @NumberProperty({
    description: '评论数',
    example: 560,
    required: true,
    default: 0,
    validation: false,
  })
  commentCount!: number

  @NumberProperty({
    description: '关注人数',
    example: 88,
    required: true,
    default: 0,
    validation: false,
  })
  followersCount!: number

  @DateProperty({
    description: '最后发表时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  lastPostAt?: Date | null

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

export class CreateForumSectionDto extends OmitType(BaseForumSectionDto, [
  ...OMIT_BASE_FIELDS,
  'lastTopicId',
  'topicCount',
  'commentCount',
  'lastPostAt',
  'deletedAt',
] as const) {}

export class UpdateForumSectionDto extends IntersectionType(
  IdDto,
  PartialType(CreateForumSectionDto),
) {}

export class QueryForumSectionDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumSectionDto, [
      'name',
      'isEnabled',
      'topicReviewPolicy',
      'groupId',
    ] as const),
  ),
) {}

export class QueryPublicForumSectionDto extends PickType(
  PartialType(BaseForumSectionDto),
  ['groupId'] as const,
) {
  @NumberProperty({
    description: '当前用户 ID（用于补充访问状态）',
    example: 1,
    required: false,
    contract: false,
  })
  userId?: number
}

export class UpdateForumSectionEnabledDto extends IntersectionType(
  IdDto,
  PickType(BaseForumSectionDto, ['isEnabled'] as const),
) {}

export class SwapForumSectionSortDto extends PickType(DragReorderDto, [
  'dragId',
  'targetId',
] as const) {}

export class ForumSectionFollowCountRepairResultDto extends IntersectionType(
  IdDto,
  PickType(BaseForumSectionDto, ['followersCount'] as const),
) {}

/**
 * 查询公开板块详情 DTO。
 */
export class QueryPublicForumSectionDetailDto extends IntersectionType(
  IdDto,
  PartialType(UserIdDto),
) {}

/**
 * 公开板块分组摘要 DTO。
 */
export class ForumSectionGroupBriefDto extends PickType(
  BaseForumSectionGroupDto,
  ['id', 'name', 'description', 'sortOrder'] as const,
) {}

/**
 * 公开板块列表项 DTO。
 */
export class PublicForumSectionListItemDto extends PickType(
  BaseForumSectionDto,
  [
    'id',
    'groupId',
    'userLevelRuleId',
    'name',
    'description',
    'icon',
    'cover',
    'sortOrder',
    'isEnabled',
    'topicReviewPolicy',
    'topicCount',
    'commentCount',
    'followersCount',
    'lastPostAt',
  ] as const,
) {
  @BooleanProperty({
    description: '当前用户是否已关注该板块',
    example: true,
    validation: false,
  })
  isFollowed!: boolean

  @BooleanProperty({
    description: '当前用户是否可访问该板块主题',
    example: false,
    validation: false,
  })
  canAccess!: boolean

  @NumberProperty({
    description: '访问该板块需要的经验值（为空表示无等级限制）',
    example: 1200,
    required: false,
    validation: false,
  })
  requiredExperience?: number | null

  @StringProperty({
    description: '无法访问时的提示信息',
    example: '请先登录后访问该板块',
    required: false,
    validation: false,
  })
  accessDeniedReason?: string
}

/**
 * 公开板块详情 DTO。
 */
export class PublicForumSectionDetailDto extends PublicForumSectionListItemDto {
  @NumberProperty({
    description: '关联作品ID（为空表示非作品专属板块）',
    example: 1,
    required: false,
    validation: false,
  })
  workId?: number | null

  @NestedProperty({
    description: '所属分组',
    required: false,
    type: ForumSectionGroupBriefDto,
    validation: false,
    nullable: false,
  })
  group?: ForumSectionGroupBriefDto
}
