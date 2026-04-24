import { BaseWorkChapterDto } from '@libs/content/work/chapter/dto/work-chapter.dto';
import { BaseWorkDto } from '@libs/content/work/core/dto/work.dto';
import { WorkTypeEnum } from '@libs/platform/constant';
import { DateProperty, EnumProperty, NestedProperty, NumberProperty } from '@libs/platform/decorators';

import { IdDto, PageDto, UserIdDto } from '@libs/platform/dto';

import { IntersectionType, PickType } from '@nestjs/swagger'
import { DownloadTargetTypeEnum } from '../download.constant'

/**
 * 基础下载记录 DTO
 */
export class BaseDownloadRecordDto extends IntersectionType(IdDto, UserIdDto) {
  @EnumProperty({
    description: '下载目标类型（1=漫画章节；2=小说章节）',
    enum: DownloadTargetTypeEnum,
    example: DownloadTargetTypeEnum.COMIC_CHAPTER,
    required: true,
  })
  targetType!: DownloadTargetTypeEnum

  @NumberProperty({
    description: '下载目标 ID',
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

export class DownloadTargetDto extends PickType(BaseDownloadRecordDto, [
  'targetId',
  'targetType',
] as const) {}

export class DownloadTargetCommandDto extends IntersectionType(
  DownloadTargetDto,
  PickType(BaseDownloadRecordDto, ['userId'] as const),
) {}

export class QueryDownloadedWorkDto extends PageDto {
  @EnumProperty({
    description: '作品类型（1=漫画；2=小说）',
    enum: WorkTypeEnum,
    example: WorkTypeEnum.COMIC,
    required: false,
  })
  workType?: WorkTypeEnum
}

export class QueryDownloadedWorkCommandDto extends IntersectionType(
  QueryDownloadedWorkDto,
  PickType(BaseDownloadRecordDto, ['userId'] as const),
) {}

export class QueryDownloadedWorkChapterDto extends QueryDownloadedWorkDto {
  @NumberProperty({
    description: '作品 ID',
    example: 1,
    required: true,
  })
  workId!: number
}

export class QueryDownloadedWorkChapterCommandDto extends IntersectionType(
  QueryDownloadedWorkChapterDto,
  PickType(BaseDownloadRecordDto, ['userId'] as const),
) {}

export class DownloadedWorkInfoDto extends PickType(BaseWorkDto, [
  'id',
  'type',
  'name',
  'cover',
] as const) {}

export class DownloadedWorkItemDto {
  @NestedProperty({
    description: '作品信息',
    type: DownloadedWorkInfoDto,
    required: true,
    nullable: false,
  })
  work!: DownloadedWorkInfoDto

  @NumberProperty({
    description: '已下载章节数',
    example: 12,
    required: true,
    min: 0,
  })
  downloadedChapterCount!: number

  @DateProperty({
    description: '最近下载时间',
    example: '2026-03-04T09:00:00.000Z',
    required: true,
  })
  lastDownloadedAt!: Date
}

export class DownloadedChapterInfoDto extends PickType(BaseWorkChapterDto, [
  'id',
  'workId',
  'title',
  'subtitle',
  'cover',
  'sortOrder',
  'isPublished',
  'publishAt',
] as const) {
  @NumberProperty({
    description: '作品类型（1=漫画；2=小说）',
    example: WorkTypeEnum.COMIC,
    required: true,
  })
  workType!: number
}

export class DownloadedWorkChapterItemDto extends BaseDownloadRecordDto {
  @NestedProperty({
    description: '章节信息',
    type: DownloadedChapterInfoDto,
    required: true,
    nullable: false,
  })
  chapter!: DownloadedChapterInfoDto
}
