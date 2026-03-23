import { BaseAppPageDto } from '@libs/app-content/page'
import { JsonProperty } from '@libs/platform/decorators'
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

export class CreateAppPageDto extends OmitType(BaseAppPageDto, [
  ...OMIT_BASE_FIELDS,
] as const) {}

export class UpdateAppPageDto extends IntersectionType(
  PartialType(CreateAppPageDto),
  IdDto,
) {}

export class QueryAppPageDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAppPageDto, ['name', 'code', 'accessLevel', 'isEnabled'] as const),
  ),
) {
  @JsonProperty({
    description: '启用平台筛选 JSON 字符串',
    example: '[1,2,3]',
    required: false,
  })
  enablePlatform?: string
}

export class AppPageResponseDto extends OmitType(BaseAppPageDto, [
  'description',
] as const) {}
