import { ContentTypeEnum } from '@libs/platform/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'

/**
 * 基础阅读状态 DTO
 */
export class BaseReadingStateDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
    min: 1,
  })
  workId!: number

  @EnumProperty({
    description: '作品类型（1=漫画，2=小说）',
    enum: ContentTypeEnum,
    example: ContentTypeEnum.COMIC,
    required: true,
  })
  workType!: ContentTypeEnum

  @DateProperty({
    description: '最近阅读时间',
    example: '2026-03-10T08:00:00.000Z',
    required: true,
    validation: false,
  })
  lastReadAt!: Date

  @NumberProperty({
    description: '最近阅读的章节ID',
    example: 1,
    required: false,
    min: 1,
  })
  lastReadChapterId?: number
}

export class QueryReadingHistoryDto extends PageDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: false,
    min: 1,
  })
  userId?: number

  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: false,
    min: 1,
  })
  workId?: number

  @EnumProperty({
    description: '作品类型（1=漫画，2=小说）',
    enum: ContentTypeEnum,
    example: ContentTypeEnum.COMIC,
    required: false,
  })
  workType?: ContentTypeEnum
}

export class ClearReadingHistoryDto {
  @EnumProperty({
    description: '作品类型（1=漫画，2=小说）',
    enum: ContentTypeEnum,
    example: ContentTypeEnum.COMIC,
    required: false,
  })
  workType?: ContentTypeEnum
}

export class WorkDto {
  @NumberProperty({
    description: '主键id',
    example: 1,
    required: true,
  })
  id!: number

  @EnumProperty({
    description: '作品类型（1=漫画, 2=小说）',
    example: ContentTypeEnum.COMIC,
    required: true,
    enum: ContentTypeEnum,
  })
  type!: ContentTypeEnum

  @StringProperty({
    description: '作品名称',
    example: '进击的巨人',
    required: true,
    maxLength: 100,
  })
  name!: string

  @StringProperty({
    description: '作品封面URL',
    example: 'https://example.com/cover.jpg',
    required: true,
    maxLength: 500,
  })
  cover!: string

  @BooleanProperty({
    description: '作品是否已删除',
    example: false,
    required: false,
    validation: false,
  })
  shouldDelete?: boolean
}

export class WorkChapterDto {
  @NumberProperty({
    description: '主键id',
    example: 1,
    required: true,
  })
  id!: number

  @StringProperty({
    description: '作品封面URL',
    example: 'https://example.com/cover.jpg',
    required: true,
    maxLength: 500,
  })
  cover!: string

  @StringProperty({
    description: '章节标题',
    example: '第1话',
    required: true,
    maxLength: 100,
  })
  title!: string

  @StringProperty({
    description: '章节副标题',
    example: '序幕',
    required: false,
    maxLength: 200,
  })
  subtitle?: string

  @NumberProperty({
    description: '章节序号',
    example: 1,
    required: true,
    min: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '章节是否已删除',
    example: false,
    required: false,
    validation: false,
  })
  shouldDelete?: boolean
}

export class ReadingHistoryWorkDto extends BaseReadingStateDto {
  @NestedProperty({
    description: '作品信息',
    type: WorkDto,
    required: true,
    validation: false,
  })
  work!: WorkDto

  @NestedProperty({
    description: '继续阅读章节',
    type: WorkChapterDto,
    required: false,
    validation: false,
  })
  continueChapter?: WorkChapterDto
}
