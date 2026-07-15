import {
  DateProperty,
  NestedProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { PickType } from '@nestjs/swagger'
import { BaseWorkDto } from './work.dto'

/**
 * 已下载作品摘要 DTO。
 */
export class DownloadedWorkInfoDto extends PickType(BaseWorkDto, [
  'id',
  'type',
  'name',
  'cover',
] as const) {}

/**
 * 已下载作品分页项 DTO。
 */
export class DownloadedWorkItemDto {
  @NestedProperty({
    description: '作品信息',
    type: DownloadedWorkInfoDto,
    required: true,
    nullable: false,
    validation: false,
  })
  work!: DownloadedWorkInfoDto

  @NumberProperty({
    description: '已下载章节数',
    example: 12,
    required: true,
    min: 0,
    validation: false,
  })
  downloadedChapterCount!: number

  @DateProperty({
    description: '最近下载时间',
    example: '2026-03-04T09:00:00.000Z',
    required: true,
    validation: false,
  })
  lastDownloadedAt!: Date
}
