import {
  BaseForumSectionDto,
  BaseForumSectionGroupDto,
} from '@libs/forum'
import { NestedProperty } from '@libs/platform/decorators'
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
  'replyCount',
  'lastPostAt',
] as const) {}

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
