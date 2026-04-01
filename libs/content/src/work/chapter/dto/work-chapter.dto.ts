import { WorkViewPermissionEnum } from '@libs/platform/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'

export class BaseWorkChapterDto extends BaseDto {
  @NumberProperty({ description: '作品ID', example: 1, required: true })
  workId!: number

  @NumberProperty({ description: '作品类型', example: 1, required: true })
  workType!: number

  @StringProperty({
    description: '章节标题',
    example: '第1话',
    required: true,
    maxLength: 100,
  })
  title!: string

  @StringProperty({
    description: '章节副标题',
    example: '序章',
    required: false,
    maxLength: 200,
  })
  subtitle?: string

  @StringProperty({
    description: '章节封面',
    example: 'https://example.com/cover.jpg',
    required: false,
    maxLength: 500,
  })
  cover?: string

  @StringProperty({
    description: '章节简介',
    example: '章节简介',
    required: false,
    maxLength: 1000,
  })
  description?: string

  @NumberProperty({ description: '排序值', example: 1, required: true })
  sortOrder!: number

  @BooleanProperty({ description: '是否发布', example: false, required: true })
  isPublished!: boolean

  @BooleanProperty({ description: '是否试读', example: false, required: true })
  isPreview!: boolean

  @DateProperty({
    description: '发布时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  publishAt?: Date

  @EnumProperty({
    description: '查看规则',
    example: WorkViewPermissionEnum.INHERIT,
    required: true,
    enum: WorkViewPermissionEnum,
  })
  viewRule!: WorkViewPermissionEnum

  @NumberProperty({
    description: '阅读所需会员等级ID',
    example: 1,
    required: false,
  })
  requiredViewLevelId?: number

  @NumberProperty({ description: '章节价格', example: 0, required: true })
  price!: number

  @BooleanProperty({
    description: '是否允许下载',
    example: true,
    required: true,
  })
  canDownload!: boolean

  @BooleanProperty({
    description: '是否允许评论',
    example: true,
    required: true,
  })
  canComment!: boolean

  @StringProperty({
    description: '章节内容',
    example: '内容路径或文本',
    required: false,
  })
  content?: string

  @NumberProperty({
    description: '字数',
    example: 3000,
    required: true,
    validation: false,
  })
  wordCount!: number

  @NumberProperty({
    description: '浏览数',
    example: 100,
    required: true,
    validation: false,
  })
  viewCount!: number

  @NumberProperty({
    description: '点赞数',
    example: 10,
    required: true,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '评论数',
    example: 10,
    required: true,
    validation: false,
  })
  commentCount!: number

  @NumberProperty({
    description: '购买数',
    example: 10,
    required: true,
    validation: false,
  })
  purchaseCount!: number

  @NumberProperty({
    description: '下载数',
    example: 10,
    required: true,
    validation: false,
  })
  downloadCount!: number

  @StringProperty({
    description: '备注',
    example: '管理员备注',
    required: false,
    maxLength: 1000,
  })
  remark?: string

  @DateProperty({
    description: '删除时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}
