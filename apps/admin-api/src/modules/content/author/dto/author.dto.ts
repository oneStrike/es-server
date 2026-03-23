import { BaseAuthorDto as ContentBaseAuthorDto } from '@libs/content'
import { JsonProperty } from '@libs/platform/decorators'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class BaseAuthorDto extends ContentBaseAuthorDto {}

export class CreateAuthorDto extends OmitType(BaseAuthorDto, [
  ...OMIT_BASE_FIELDS,
  'workCount',
  'isEnabled',
  'isRecommended',
  'followersCount',
] as const) {}

export class UpdateAuthorDto extends IntersectionType(CreateAuthorDto, IdDto) {}

export class QueryAuthorDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAuthorDto, [
      'name',
      'isEnabled',
      'nationality',
      'gender',
      'isRecommended',
    ] as const),
  ),
) {
  @JsonProperty({
    description: '作者角色类型',
    example: '[123]',
    required: false,
  })
  type?: string
}

export class UpdateAuthorRecommendedDto extends IntersectionType(
  PickType(BaseAuthorDto, ['isRecommended'] as const),
  IdDto,
) {}

export class UpdateAuthorStatusDto extends IntersectionType(
  PickType(BaseAuthorDto, ['isEnabled'] as const),
  IdDto,
) {}

export class AuthorFollowCountRepairResultDto extends IntersectionType(
  IdDto,
  PickType(BaseAuthorDto, ['followersCount'] as const),
) {}

export class AuthorPageResponseDto extends OmitType(BaseAuthorDto, [
  'remark',
  'description',
] as const) {}
