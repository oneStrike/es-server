import { WorkViewPermissionEnum } from '@libs/base/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/// 章节基础DTO
export class BaseWorkChapterDto extends BaseDto {
  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
  })
  workId!: number

  @NumberProperty({
    description: '作品类型（1=漫画, 2=小说）',
    example: 1,
    required: true,
  })
  workType!: number

  @StringProperty({
    description: '章节标题',
    example: '第1话 巨人的来袭',
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

  @StringProperty({
    description: '章节封面',
    example: 'https://example.com/cover.jpg',
    required: false,
    maxLength: 500,
  })
  cover?: string

  @StringProperty({
    description: '章节描述',
    example: '这是第一章的内容描述',
    required: false,
    maxLength: 1000,
  })
  description?: string

  @NumberProperty({
    description: '章节序号',
    example: 1,
    required: true,
    min: 0,
  })
  sortOrder!: number

  @EnumProperty({
    description: '查看规则（-1=继承, 0=所有人, 1=登录用户, 2=会员, 3=积分购买）',
    example: WorkViewPermissionEnum.INHERIT,
    required: true,
    enum: WorkViewPermissionEnum,
    default: WorkViewPermissionEnum.INHERIT,
  })
  viewRule!: WorkViewPermissionEnum

  @NumberProperty({
    description: '章节价格（0=免费）',
    example: 0,
    required: true,
    default: 0,
  })
  price!: number

  @NumberProperty({
    description: '阅读所需会员等级ID',
    example: 1,
    required: false,
  })
  requiredViewLevelId?: number

  @NumberProperty({
    description: '章节兑换积分',
    example: 0,
    required: true,
    default: 0,
  })
  exchangePoints!: number

  @BooleanProperty({
    description: '是否允许兑换',
    example: false,
    required: true,
    default: false,
  })
  canExchange!: boolean

  @BooleanProperty({
    description: '是否允许下载',
    example: true,
    required: true,
    default: true,
  })
  canDownload!: boolean

  @BooleanProperty({
    description: '发布状态',
    example: false,
    required: true,
    default: false,
  })
  isPublished!: boolean

  @BooleanProperty({
    description: '是否为试读章节',
    example: false,
    required: true,
    default: false,
  })
  isPreview!: boolean

  @BooleanProperty({
    description: '是否允许评论',
    example: true,
    required: true,
    default: true,
  })
  canComment!: boolean

  @DateProperty({
    description: '发布时间',
    example: '2024-01-01',
    required: false,
  })
  publishAt?: Date

  @NumberProperty({
    description: '阅读次数',
    example: 1000,
    required: true,
    default: 0,
    validation: false,
  })
  viewCount!: number

  @NumberProperty({
    description: '点赞数',
    example: 100,
    required: true,
    default: 0,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '评论数',
    example: 50,
    required: true,
    default: 0,
    validation: false,
  })
  commentCount!: number

  @NumberProperty({
    description: '购买次数',
    example: 20,
    required: true,
    default: 0,
    validation: false,
  })
  purchaseCount!: number

  @NumberProperty({
    description: '下载次数',
    example: 20,
    required: true,
    default: 0,
    validation: false,
  })
  downloadCount!: number

  @NumberProperty({
    description: '字数（小说章节）',
    example: 3000,
    required: true,
    default: 0,
    validation: false,
  })
  wordCount!: number

  @StringProperty({
    description: '内容存储路径',
    example: '/uploads/chapters/1/',
    required: false,
    maxLength: 500,
  })
  content?: string

  @StringProperty({
    description: '备注',
    example: '管理员备注',
    required: false,
    maxLength: 1000,
  })
  remark?: string
}

/// 创建章节DTO
export class CreateWorkChapterDto extends OmitType(BaseWorkChapterDto, [
  ...OMIT_BASE_FIELDS,
  'viewCount',
  'likeCount',
  'commentCount',
  'purchaseCount',
  'downloadCount',
  'wordCount',
]) {}

// 分页返回的章节DTO
export class PageWorkChapterDto extends PickType(BaseWorkChapterDto, [
  'id',
  'isPreview',
  'cover',
  'title',
  'canComment',
  'sortOrder',
  'viewRule',
  'canDownload',
  'price',
  'requiredViewLevelId',
]) {}

/// 更新章节DTO
export class UpdateWorkChapterDto extends IntersectionType(
  PartialType(CreateWorkChapterDto),
  IdDto,
) {}

/// 查询章节DTO
export class QueryWorkChapterDto extends IntersectionType(
  IntersectionType(PageDto, PickType(BaseWorkChapterDto, ['workId'])),
  PickType(PartialType(BaseWorkChapterDto), [
    'title',
    'isPublished',
    'isPreview',
    'viewRule',
  ]),
) {}

/// 章节用户状态字段DTO
export class ChapterUserStatusFieldsDto {
  @BooleanProperty({
    description: '是否已点赞',
    example: true,
    required: true,
    validation: false,
  })
  liked!: boolean

  @BooleanProperty({
    description: '是否已购买',
    example: false,
    required: true,
    validation: false,
  })
  purchased!: boolean

  @BooleanProperty({
    description: '是否已下载',
    example: false,
    required: true,
    validation: false,
  })
  downloaded!: boolean
}

/// 章节分页带用户状态DTO
export class WorkChapterPageWithUserStatusDto extends IntersectionType(
  BaseWorkChapterDto,
  ChapterUserStatusFieldsDto,
) {}

/// 章节详情带用户状态DTO
export class WorkChapterDetailWithUserStatusDto extends WorkChapterPageWithUserStatusDto {}

/// 章节用户状态DTO
export class WorkChapterUserStatusDto extends IntersectionType(
  IdDto,
  ChapterUserStatusFieldsDto,
) {}
