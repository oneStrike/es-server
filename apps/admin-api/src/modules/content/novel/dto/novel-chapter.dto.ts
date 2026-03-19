import {
  BaseWorkChapterDto as ContentBaseWorkChapterDto,
} from '@libs/content'
import { BooleanProperty } from '@libs/platform/decorators'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class BaseWorkChapterDto extends ContentBaseWorkChapterDto {}

export class CreateWorkChapterDto extends OmitType(BaseWorkChapterDto, [
  ...OMIT_BASE_FIELDS,
  'viewCount',
  'likeCount',
  'commentCount',
  'purchaseCount',
  'downloadCount',
  'wordCount',
  'deletedAt',
]) {
  @BooleanProperty({ description: '发布状态', example: false, required: false, default: false })
  isPublished!: boolean
}

export class QueryWorkChapterDto extends IntersectionType(
  IntersectionType(PageDto, PickType(BaseWorkChapterDto, ['workId'])),
  PickType(PartialType(BaseWorkChapterDto), [
    'title',
    'isPublished',
    'isPreview',
    'viewRule',
    'canDownload',
    'canComment',
  ]),
) {}

export class UpdateWorkChapterDto extends IntersectionType(
  PartialType(CreateWorkChapterDto),
  IdDto,
) {}
