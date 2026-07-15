import { BaseDownloadRecordDto } from '@libs/interaction/download/dto/download.dto'
import { NestedProperty } from '@libs/platform/decorators'
import { PickType } from '@nestjs/swagger'
import { BaseWorkChapterDto } from './work-chapter.dto'

/**
 * 已下载章节摘要 DTO。
 */
export class DownloadedChapterInfoDto extends PickType(BaseWorkChapterDto, [
  'id',
  'workId',
  'workType',
  'title',
  'subtitle',
  'cover',
  'sortOrder',
  'isPublished',
  'publishAt',
] as const) {}

/**
 * 已下载章节分页项 DTO。
 */
export class DownloadedWorkChapterItemDto extends BaseDownloadRecordDto {
  @NestedProperty({
    description: '章节信息',
    type: DownloadedChapterInfoDto,
    required: true,
    nullable: false,
    validation: false,
  })
  chapter!: DownloadedChapterInfoDto
}
