import { WorkTypeEnum } from '@libs/base/constant'
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
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { DownloadTargetTypeEnum } from '../download.constant'

export class BaseUserDownloadRecordDto extends PickType(BaseDto, [
  'id',
  'createdAt',
]) {
  @EnumProperty({
    description: '目标类型：1=漫画, 2=小说, 3=漫画章节, 4=小说章节',
    enum: DownloadTargetTypeEnum,
    example: 1,
    required: true,
  })
  targetType!: DownloadTargetTypeEnum

  @NumberProperty({
    description: '目标ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class UserDownloadRecordKeyDto extends PickType(
  BaseUserDownloadRecordDto,
  ['targetType', 'targetId', 'userId'],
) {}

export class QueryUserDownloadRecordDto extends IntersectionType(
  IntersectionType(
    PageDto,
    PartialType(PickType(BaseUserDownloadRecordDto, ['targetType'])),
  ),
  PickType(BaseUserDownloadRecordDto, ['userId']),
) {}

export class QueryDownloadedWorkDto extends IntersectionType(
  PageDto,
  PickType(BaseUserDownloadRecordDto, ['userId']),
) {
  @EnumProperty({
    description: '作品类型：1=漫画, 2=小说',
    enum: WorkTypeEnum,
    example: WorkTypeEnum.COMIC,
    required: false,
  })
  workType?: WorkTypeEnum
}

export class QueryDownloadedWorkChapterDto extends QueryDownloadedWorkDto {
  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
  })
  workId!: number
}

export class DownloadedWorkInfoDto {
  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
  })
  id!: number

  @NumberProperty({
    description: '作品类型：1=漫画, 2=小说',
    example: 1,
    required: true,
  })
  type!: number

  @StringProperty({
    description: '作品名称',
    example: '鬼灭之刃',
    required: true,
  })
  name!: string

  @StringProperty({
    description: '作品封面',
    example: '/uploads/work/cover-1.jpg',
    required: true,
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
  })
  total!: number

  @NumberProperty({
    description: '页码',
    example: 0,
    required: true,
    min: 0,
  })
  pageIndex!: number

  @NumberProperty({
    description: '每页数量',
    example: 15,
    required: true,
    min: 1,
  })
  pageSize!: number
}

export class DownloadedChapterInfoDto {
  @NumberProperty({
    description: '章节ID',
    example: 101,
    required: true,
  })
  id!: number

  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
  })
  workId!: number

  @NumberProperty({
    description: '作品类型：1=漫画, 2=小说',
    example: 1,
    required: true,
  })
  workType!: number

  @StringProperty({
    description: '章节标题',
    example: '第1话',
    required: true,
  })
  title!: string

  @StringProperty({
    description: '章节副标题',
    example: '初次登场',
    required: false,
  })
  subtitle?: string | null

  @StringProperty({
    description: '章节封面',
    example: '/uploads/chapter/cover-1.jpg',
    required: false,
  })
  cover?: string | null

  @NumberProperty({
    description: '章节排序',
    example: 1,
    required: true,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否发布',
    example: true,
    required: true,
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
    description: '下载记录ID',
    example: 1,
    required: true,
  })
  id!: number

  @EnumProperty({
    description: '目标类型：3=漫画章节, 4=小说章节',
    enum: DownloadTargetTypeEnum,
    example: DownloadTargetTypeEnum.COMIC_CHAPTER,
    required: true,
  })
  targetType!: DownloadTargetTypeEnum

  @NumberProperty({
    description: '目标ID（章节ID）',
    example: 101,
    required: true,
  })
  targetId!: number

  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
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
  })
  total!: number

  @NumberProperty({
    description: '页码',
    example: 0,
    required: true,
    min: 0,
  })
  pageIndex!: number

  @NumberProperty({
    description: '每页数量',
    example: 15,
    required: true,
    min: 1,
  })
  pageSize!: number
}
