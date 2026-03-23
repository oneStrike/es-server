import { BaseWorkChapterDto } from '@libs/content/work'
import {
  ArrayProperty,
  BooleanProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { TargetCommentItemDto } from '../../comment/dto/comment.dto'

export class PageWorkChapterDto extends PickType(BaseWorkChapterDto, [
  'id',
  'isPreview',
  'cover',
  'title',
  'subtitle',
  'canComment',
  'sortOrder',
  'viewRule',
  'canDownload',
  'price',
  'requiredViewLevelId',
  'publishAt',
  'createdAt',
  'updatedAt',
  'isPublished',
]) {}

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

class ChapterUserStatusFieldsDto {
  @BooleanProperty({ description: '是否已点赞', example: true, required: true, validation: false })
  liked!: boolean

  @BooleanProperty({ description: '是否已购买', example: false, required: true, validation: false })
  purchased!: boolean

  @BooleanProperty({ description: '是否已下载', example: false, required: true, validation: false })
  downloaded!: boolean
}

export class ComicChapterContentDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkChapterDto, ['title', 'subtitle']),
) {
  @ArrayProperty({ description: '章节图片内容', itemType: 'string', required: true, validation: false })
  content!: string[]
}

export class NovelChapterContentDto extends IntersectionType(
  IdDto,
  OmitType(ComicChapterContentDto, ['content']),
  PickType(BaseWorkChapterDto, ['content']),
) {}

export class WorkChapterDetailWithUserStatusDto extends IntersectionType(
  BaseWorkChapterDto,
  ChapterUserStatusFieldsDto,
  PickType(ComicChapterContentDto, ['content']),
) {}

export class QueryWorkChapterCommentPageDto extends IntersectionType(PageDto, IdDto) {}

export class WorkChapterCommentItemDto extends TargetCommentItemDto {}
