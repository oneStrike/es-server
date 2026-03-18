import {
  BaseDictionaryDto,
  BaseDictionaryItemDto,
} from '@libs/dictionary'
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

export class CreateDictionaryDto extends OmitType(BaseDictionaryDto, [
  ...OMIT_BASE_FIELDS,
] as const) {}

export class CreateDictionaryItemDto extends OmitType(BaseDictionaryItemDto, [
  ...OMIT_BASE_FIELDS,
] as const) {}

export class UpdateDictionaryDto extends IntersectionType(
  CreateDictionaryDto,
  IdDto,
) {}

export class UpdateDictionaryItemDto extends IntersectionType(
  CreateDictionaryItemDto,
  IdDto,
) {}

export class QueryDictionaryDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseDictionaryDto, ['name', 'code', 'isEnabled'] as const),
  ),
) {}

export class QueryDictionaryItemDto extends IntersectionType(
  PickType(BaseDictionaryItemDto, ['dictionaryCode'] as const),
  PartialType(
    PickType(QueryDictionaryDto, [
      'name',
      'code',
      'isEnabled',
      'orderBy',
      'pageIndex',
      'pageSize',
    ] as const),
  ),
) {}

export class QueryAllDictionaryItemDto extends PickType(BaseDictionaryItemDto, [
  'dictionaryCode',
] as const) {}
