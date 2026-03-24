import { BaseForumSectionDto } from '@libs/forum/section'
import {
  IdDto,
  OMIT_BASE_FIELDS,
  PageDto,
} from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateForumSectionDto extends OmitType(
  BaseForumSectionDto,
  [
    ...OMIT_BASE_FIELDS,
    'lastTopicId',
    'topicCount',
    'commentCount',
    'lastPostAt',
    'deletedAt',
  ] as const,
) {}

export class UpdateForumSectionDto extends IntersectionType(
  CreateForumSectionDto,
  IdDto,
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

export class ForumSectionFollowCountRepairResultDto extends IntersectionType(
  IdDto,
  PickType(BaseForumSectionDto, ['followersCount'] as const),
) {}

