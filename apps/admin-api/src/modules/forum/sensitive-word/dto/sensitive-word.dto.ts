import { BaseSensitiveWordDto } from '@libs/sensitive-word'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateSensitiveWordDto extends OmitType(
  BaseSensitiveWordDto,
  [
    ...OMIT_BASE_FIELDS,
    'version',
    'createdBy',
    'updatedBy',
    'hitCount',
    'lastHitAt',
  ] as const,
) {}

export class UpdateSensitiveWordDto extends IntersectionType(
  CreateSensitiveWordDto,
  IdDto,
) {}

export class QuerySensitiveWordDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(CreateSensitiveWordDto, [
      'word',
      'isEnabled',
      'level',
      'matchMode',
      'type',
    ] as const),
  ),
) {}
