import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { BaseGrowthRuleConfigDto } from '../../growth/dto/growth-shared.dto'

export class BaseUserExperienceRuleDto extends BaseGrowthRuleConfigDto {
  @NumberProperty({
    description: '经验奖励值（正整数）',
    example: 5,
    required: true,
    min: 1,
  })
  experience!: number
}

export class CreateUserExperienceRuleDto extends OmitType(
  BaseUserExperienceRuleDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateUserExperienceRuleDto extends IntersectionType(
  IdDto,
  PartialType(CreateUserExperienceRuleDto),
) {}

export class QueryUserExperienceRuleDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserExperienceRuleDto, ['type', 'isEnabled'] as const),
  ),
) {}
