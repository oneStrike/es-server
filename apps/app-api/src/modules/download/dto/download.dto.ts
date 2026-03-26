import {
  BaseWorkChapterDto,
  BaseWorkDto,
} from '@libs/content/work'
import { BaseDownloadRecordDto } from '@libs/interaction/download'
import { ContentTypeEnum, WorkTypeEnum } from '@libs/platform/constant'
import {
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, OmitType, PickType } from '@nestjs/swagger'

export class DownloadTargetDto extends PickType(BaseDownloadRecordDto, [
  'targetId',
  'targetType',
]) {}

export class QueryDownloadedWorkDto extends IntersectionType(
  PageDto,
  PickType(BaseDownloadRecordDto, ['userId']),
) {
  @EnumProperty({
    description: '作品类型（1=漫画，2=小说）',
    enum: WorkTypeEnum,
    example: WorkTypeEnum.COMIC,
    required: false,
  })
  workType?: WorkTypeEnum
}

export class AppQueryDownloadedWorkDto extends OmitType(QueryDownloadedWorkDto, ['userId']) {}

export class QueryDownloadedWorkChapterDto extends IntersectionType(
  QueryDownloadedWorkDto,
  PickType(BaseDownloadRecordDto, ['targetId']),
) {
  @NumberProperty({
    description: '作品 ID',
    example: 1,
    required: true,
  })
  workId!: number
}

export class AppQueryDownloadedWorkChapterDto extends OmitType(QueryDownloadedWorkChapterDto, ['userId']) {}

export class DownloadedWorkInfoDto extends PickType(BaseWorkDto, [
  'id',
  'type',
  'name',
  'cover',
]) {}

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
]) {
  @NumberProperty({
    description: '作品类型（1=漫画，2=小说）',
    example: ContentTypeEnum.COMIC,
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
