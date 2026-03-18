import {
  DateProperty,
  EnumProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { IdDto, UserIdDto } from '@libs/platform/dto'
import { IntersectionType } from '@nestjs/swagger'
import { DownloadTargetTypeEnum } from '../download.constant'

/**
 * 基础下载记录 DTO (全量字段)
 */
export class BaseDownloadRecordDto extends IntersectionType(IdDto, UserIdDto) {
  @EnumProperty({
    description: '下载目标类型（3=漫画章节，4=小说章节）',
    enum: DownloadTargetTypeEnum,
    example: DownloadTargetTypeEnum.COMIC_CHAPTER,
    required: true,
  })
  targetType!: DownloadTargetTypeEnum

  @NumberProperty({
    description: '下载的目标id',
    example: 1,
    required: true,
  })
  targetId!: number

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}
