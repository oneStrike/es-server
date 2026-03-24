import { BaseForumSectionDto } from '@libs/forum/section'
import { BaseForumSectionGroupDto } from '@libs/forum/section-group'
import { BooleanProperty, NestedProperty } from '@libs/platform/decorators'
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
}

export class AppForumSectionDetailDto extends AppForumSectionListItemDto {
  @NestedProperty({
    description: '所属分组',
    required: false,
    type: AppForumSectionGroupBriefDto,
    validation: false,
    nullable: false,
  })
  group?: AppForumSectionGroupBriefDto
}

