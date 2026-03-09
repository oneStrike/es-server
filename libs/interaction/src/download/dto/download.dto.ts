import { ContentTypeEnum } from '@libs/base/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PickType } from '@nestjs/swagger'
import { DownloadTargetTypeEnum } from '../download.constant'

export class BaseUserDownloadRecordDto extends PickType(BaseDto, [
  'id',
  'createdAt',
]) {
  @EnumProperty({
    description: '目标类型（3=漫画章节，4=小说章节）',
    enum: DownloadTargetTypeEnum,
    example: DownloadTargetTypeEnum.COMIC_CHAPTER,
    required: true,
  })
  targetType!: DownloadTargetTypeEnum

  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class UserDownloadRecordKeyDto extends PickType(
  BaseUserDownloadRecordDto,
  ['targetType', 'targetId', 'userId'],
) {}

export class QueryDownloadedWorkDto extends IntersectionType(
  PageDto,
  PickType(BaseUserDownloadRecordDto, ['userId']),
) {
  @EnumProperty({
    description: '作品类型（1=漫画，2=小说）',
    enum: ContentTypeEnum,
    example: ContentTypeEnum.COMIC,
    required: false,
  })
  workType?: ContentTypeEnum
}

export class QueryDownloadedWorkChapterDto extends QueryDownloadedWorkDto {
  @NumberProperty({
    description: '作品 ID',
    example: 1,
    required: true,
  })
  workId!: number
}

export class DownloadedWorkInfoDto {
  @NumberProperty({
    description: '作品 ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @NumberProperty({
    description: '作品类型（1=漫画，2=小说）',
    example: ContentTypeEnum.COMIC,
    required: true,
    validation: false,
  })
  type!: number

  @StringProperty({
    description: '作品名称',
    example: '鬼灭之刃',
    required: true,
    validation: false,
  })
  name!: string

  @StringProperty({
    description: '作品封面',
    example: '/uploads/work/cover-1.jpg',
    required: true,
    validation: false,
  })
  cover!: string
}

export class DownloadedWorkItemDto {
  @NestedProperty({
    description: '作品信息',
    type: DownloadedWorkInfoDto,
    required: true,
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

export class DownloadedWorkPageDto {
  @ArrayProperty({
    description: '已下载作品列表',
    itemClass: DownloadedWorkItemDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  list!: DownloadedWorkItemDto[]

  @NumberProperty({
    description: '总数',
    example: 100,
    required: true,
    min: 0,
    validation: false,
  })
  total!: number

  @NumberProperty({
    description: '页码',
    example: 0,
    required: true,
    min: 0,
    validation: false,
  })
  pageIndex!: number

  @NumberProperty({
    description: '每页数量',
    example: 15,
    required: true,
    min: 1,
    validation: false,
  })
  pageSize!: number
}

export class DownloadedChapterInfoDto {
  @NumberProperty({
    description: '章节 ID',
    example: 101,
    required: true,
    validation: false,
  })
  id!: number

  @NumberProperty({
    description: '作品 ID',
    example: 1,
    required: true,
    validation: false,
  })
  workId!: number

  @NumberProperty({
    description: '作品类型（1=漫画，2=小说）',
    example: ContentTypeEnum.COMIC,
    required: true,
    validation: false,
  })
  workType!: number

  @StringProperty({
    description: '章节标题',
    example: '第1话',
    required: true,
    validation: false,
  })
  title!: string

  @StringProperty({
    description: '章节副标题',
    example: '初次登场',
    required: false,
    validation: false,
  })
  subtitle?: string | null

  @StringProperty({
    description: '章节封面',
    example: '/uploads/chapter/cover-1.jpg',
    required: false,
    validation: false,
  })
  cover?: string | null

  @NumberProperty({
    description: '章节排序',
    example: 1,
    required: true,
    validation: false,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否已发布',
    example: true,
    required: true,
    validation: false,
  })
  isPublished!: boolean

  @DateProperty({
    description: '发布时间',
    example: '2026-03-04T09:00:00.000Z',
    required: false,
    validation: false,
  })
  publishAt?: Date | null
}

export class DownloadedWorkChapterItemDto {
  @NumberProperty({
    description: '下载记录 ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @EnumProperty({
    description: '目标类型（3=漫画章节，4=小说章节）',
    enum: DownloadTargetTypeEnum,
    example: DownloadTargetTypeEnum.COMIC_CHAPTER,
    required: true,
    validation: false,
  })
  targetType!: DownloadTargetTypeEnum

  @NumberProperty({
    description: '目标 ID（章节 ID）',
    example: 101,
    required: true,
    validation: false,
  })
  targetId!: number

  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
    validation: false,
  })
  userId!: number

  @DateProperty({
    description: '下载时间',
    example: '2026-03-04T09:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date

  @NestedProperty({
    description: '章节信息',
    type: DownloadedChapterInfoDto,
    required: true,
    validation: false,
  })
  chapter!: DownloadedChapterInfoDto
}

export class DownloadedWorkChapterPageDto {
  @ArrayProperty({
    description: '已下载章节列表',
    itemClass: DownloadedWorkChapterItemDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  list!: DownloadedWorkChapterItemDto[]

  @NumberProperty({
    description: '总数',
    example: 100,
    required: true,
    min: 0,
    validation: false,
  })
  total!: number

  @NumberProperty({
    description: '页码',
    example: 0,
    required: true,
    min: 0,
    validation: false,
  })
  pageIndex!: number

  @NumberProperty({
    description: '每页数量',
    example: 15,
    required: true,
    min: 1,
    validation: false,
  })
  pageSize!: number
}
