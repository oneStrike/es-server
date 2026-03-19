import { BaseUserPointRuleDto } from '@libs/growth'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateUserPointRuleDto extends OmitType(
  BaseUserPointRuleDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateUserPointRuleDto extends IntersectionType(
  CreateUserPointRuleDto,
  IdDto,
) {}

export class QueryUserPointRuleDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserPointRuleDto, ['type', 'isEnabled'] as const),
  ),
) {}
