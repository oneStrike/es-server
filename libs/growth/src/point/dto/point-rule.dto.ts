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

export class BaseUserPointRuleDto extends BaseGrowthRuleConfigDto {
  @NumberProperty({
    description: '积分奖励值（正整数）',
    example: 5,
    required: true,
    min: 1,
  })
  points!: number
}

export class CreateUserPointRuleDto extends OmitType(
  BaseUserPointRuleDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateUserPointRuleDto extends IntersectionType(
  IdDto,
  PartialType(CreateUserPointRuleDto),
) {}

export class QueryUserPointRuleDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseUserPointRuleDto, ['type', 'isEnabled'] as const)),
) {}
