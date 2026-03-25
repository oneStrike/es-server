import { BaseTagDto } from '@libs/content/tag'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateTagDto extends OmitType(BaseTagDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
  'isEnabled',
]) {}

export class QueryTagDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseTagDto), ['name', 'isEnabled']),
) {}

export class UpdateTagDto extends IntersectionType(CreateTagDto, IdDto) {}
