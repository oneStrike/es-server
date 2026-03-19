import { BaseForumSectionGroupDto } from '@libs/forum'
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

export class CreateForumSectionGroupDto extends OmitType(
  BaseForumSectionGroupDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateForumSectionGroupDto extends IntersectionType(
  PartialType(CreateForumSectionGroupDto),
  IdDto,
) {}

export class QueryForumSectionGroupDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumSectionGroupDto, ['name', 'isEnabled'] as const),
  ),
) {}
