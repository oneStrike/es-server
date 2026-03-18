import { BaseAgreementDto } from '@libs/app-content'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateAgreementDto extends OmitType(BaseAgreementDto, [
  ...OMIT_BASE_FIELDS,
  'publishedAt',
] as const) {}

export class UpdateAgreementDto extends IntersectionType(
  CreateAgreementDto,
  IdDto,
) {}

export class QueryAgreementDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAgreementDto, ['title', 'isPublished', 'showInAuth'] as const),
  ),
) {}

export class ListOrPageAgreementResponseDto extends PickType(BaseAgreementDto, [
  'content',
] as const) {}
