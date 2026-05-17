import {
  DateProperty,
  EnumProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  ContentImportItemStageEnum,
  ContentImportItemStatusEnum,
  ContentImportItemTypeEnum,
} from '../content-import.constant'

/** 内容导入工作流任务 ID 字段。 */
class ContentImportWorkflowJobIdFieldsDto {
  @StringProperty({
    description: '工作流任务ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
  })
  jobId!: string
}

/** 内容导入条目状态字段。 */
class ContentImportItemStatusFieldsDto {
  @EnumProperty({
    description: '条目状态（1=待处理；2=处理中；3=成功；4=失败；5=重试中；6=已跳过）',
    enum: ContentImportItemStatusEnum,
    example: ContentImportItemStatusEnum.FAILED,
    required: true,
  })
  status!: ContentImportItemStatusEnum
}

/** 内容导入条目 DTO。 */
export class ContentImportItemDto {
  @NumberProperty({
    description: '主键ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '内容导入条目ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
    validation: false,
  })
  itemId!: string

  @EnumProperty({
    description: '条目类型（1=漫画章节）',
    enum: ContentImportItemTypeEnum,
    example: ContentImportItemTypeEnum.COMIC_CHAPTER,
    required: true,
    validation: false,
  })
  itemType!: ContentImportItemTypeEnum

  @StringProperty({
    description: '三方章节ID',
    example: 'chapter-001',
    required: false,
    validation: false,
  })
  providerChapterId!: string | null

  @NumberProperty({
    description: '本地章节ID',
    example: 1,
    required: false,
    validation: false,
  })
  localChapterId!: number | null

  @StringProperty({
    description: '章节标题',
    example: '第1话',
    required: true,
    validation: false,
  })
  title!: string

  @NumberProperty({
    description: '排序值',
    example: 1,
    required: true,
    validation: false,
  })
  sortOrder!: number

  @EnumProperty({
    description:
      '条目状态（1=待处理；2=处理中；3=成功；4=失败；5=重试中；6=已跳过）',
    enum: ContentImportItemStatusEnum,
    example: ContentImportItemStatusEnum.FAILED,
    required: true,
    validation: false,
  })
  status!: ContentImportItemStatusEnum

  @EnumProperty({
    description:
      '当前阶段（1=预览中；2=读取来源；3=准备元数据；4=读取内容；5=导入图片；6=写入内容；7=清理残留；8=已完成）',
    enum: ContentImportItemStageEnum,
    example: ContentImportItemStageEnum.IMPORTING_IMAGES,
    required: true,
    validation: false,
  })
  stage!: ContentImportItemStageEnum

  @NumberProperty({
    description: '失败次数',
    example: 1,
    required: true,
    validation: false,
  })
  failureCount!: number

  @StringProperty({
    description: '最近错误码',
    example: 'IMAGE_UPLOAD_FAILED',
    required: false,
    validation: false,
  })
  lastErrorCode!: string | null

  @StringProperty({
    description: '最近错误信息',
    example: '上游图片下载失败',
    required: false,
    validation: false,
  })
  lastErrorMessage!: string | null

  @NumberProperty({
    description: '图片总数',
    example: 20,
    required: true,
    validation: false,
  })
  imageTotal!: number

  @NumberProperty({
    description: '图片成功数',
    example: 0,
    required: true,
    validation: false,
  })
  imageSuccessCount!: number

  @ObjectProperty({
    description: '条目元数据',
    example: { providerChapterId: 'chapter-001' },
    required: false,
    validation: false,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null

  @DateProperty({
    description: '更新时间',
    example: '2026-05-17T03:00:00.000Z',
    required: true,
    validation: false,
  })
  updatedAt!: Date
}

/** 内容导入条目分页查询 DTO。 */
export class ContentImportItemPageRequestDto extends IntersectionType(
  PageDto,
  PartialType(
    IntersectionType(
      PickType(ContentImportWorkflowJobIdFieldsDto, ['jobId'] as const),
      ContentImportItemStatusFieldsDto,
    ),
  ),
) {}
