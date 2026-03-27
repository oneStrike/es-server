import {
  BaseEmojiAssetDto,
  BaseEmojiPackDto,
} from '@libs/interaction/emoji'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateEmojiPackDto extends OmitType(BaseEmojiPackDto, [
  ...OMIT_BASE_FIELDS,
  'createdById',
  'updatedById',
  'deletedAt',
] as const) {}

export class UpdateEmojiPackDto extends IntersectionType(
  PartialType(CreateEmojiPackDto),
  IdDto,
) {}

export class UpdateEmojiPackSceneTypeDto extends IntersectionType(
  IdDto,
  PickType(BaseEmojiPackDto, ['sceneType'] as const),
) {}

export class QueryEmojiPackDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseEmojiPackDto, [
      'code',
      'name',
      'isEnabled',
      'visibleInPicker',
    ] as const),
  ),
) {}

export class CreateEmojiAssetDto extends OmitType(BaseEmojiAssetDto, [
  ...OMIT_BASE_FIELDS,
  'createdById',
  'updatedById',
  'deletedAt',
] as const) {}

export class UpdateEmojiAssetDto extends IntersectionType(
  PartialType(CreateEmojiAssetDto),
  IdDto,
) {}

export class QueryEmojiAssetDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseEmojiAssetDto, [
      'packId',
      'kind',
      'isEnabled',
      'shortcode',
      'category',
    ] as const),
  ),
) {}
