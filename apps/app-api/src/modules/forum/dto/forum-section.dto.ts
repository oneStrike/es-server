import { BaseForumSectionDto } from '@libs/forum/section'
import { BaseForumSectionGroupDto } from '@libs/forum/section-group'
import {
  BooleanProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PartialType, PickType } from '@nestjs/swagger'

export class QueryAppForumSectionDto extends PartialType(
  PickType(BaseForumSectionDto, ['groupId'] as const),
) {}

export class AppForumSectionGroupBriefDto extends PickType(
  BaseForumSectionGroupDto,
  ['id', 'name', 'description', 'sortOrder'] as const,
) {}

export class AppForumSectionListItemDto extends PickType(BaseForumSectionDto, [
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
] as const) {
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

export class AppForumSectionDetailDto extends AppForumSectionListItemDto {
  @NestedProperty({
    description: '所属分组',
    required: false,
    type: AppForumSectionGroupBriefDto,
    validation: false
  })
  group?: AppForumSectionGroupBriefDto
}
