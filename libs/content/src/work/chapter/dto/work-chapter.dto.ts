import { CommentSortDto } from '@libs/interaction/comment/dto/comment.dto'
import {
  PurchasePricingDto,
  PurchasePricingFieldsDto,
} from '@libs/interaction/purchase/dto/purchase-pricing.dto'
import { WorkViewPermissionEnum } from '@libs/platform/constant/content.constant'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { DateProperty } from '@libs/platform/decorators/validate/date-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

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
    description: '查看规则（-1=继承作品；0=所有人可见；1=登录用户可见；2=会员可见；3=需购买可见）',
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
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

export class CreateWorkChapterDto extends OmitType(BaseWorkChapterDto, [
  ...OMIT_BASE_FIELDS,
  'viewCount',
  'likeCount',
  'commentCount',
  'purchaseCount',
  'downloadCount',
  'wordCount',
  'deletedAt',
] as const) {
  @BooleanProperty({
    description: '发布状态',
    example: false,
    required: false,
    default: false,
  })
  isPublished!: boolean
}

export class QueryWorkChapterDto extends IntersectionType(
  PageDto,
  PickType(BaseWorkChapterDto, ['workId'] as const),
  PickType(PartialType(BaseWorkChapterDto), [
    'title',
    'isPublished',
    'isPreview',
    'viewRule',
    'canDownload',
    'canComment',
  ] as const),
) {}

export class UpdateWorkChapterDto extends IntersectionType(
  PartialType(CreateWorkChapterDto),
  IdDto,
) {}

export class QueryWorkChapterCommentPageDto extends IntersectionType(
  PageDto,
  IdDto,
  PartialType(CommentSortDto),
) {}

/**
 * 作品章节分页项 DTO。
 */
export class PageWorkChapterDto extends PickType(BaseWorkChapterDto, [
  'id',
  'isPreview',
  'cover',
  'title',
  'subtitle',
  'canComment',
  'sortOrder',
  'viewRule',
  'canDownload',
  'requiredViewLevelId',
  'publishAt',
  'createdAt',
  'updatedAt',
  'isPublished',
] as const) {
  @NestedProperty({
    description: '购买价格信息',
    type: PurchasePricingDto,
    required: false,
    validation: false,
    nullable: true,
  })
  purchasePricing!: PurchasePricingDto | null
}

class ChapterUserStatusFieldsDto {
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

class WorkChapterDetailBodyBaseDto extends PickType(BaseWorkChapterDto, [
  'id',
  'workId',
  'workType',
  'title',
  'subtitle',
  'cover',
  'description',
  'sortOrder',
  'isPublished',
  'isPreview',
  'publishAt',
  'viewRule',
  'requiredViewLevelId',
  'canDownload',
  'canComment',
  'content',
  'wordCount',
  'viewCount',
  'likeCount',
  'commentCount',
  'purchaseCount',
  'downloadCount',
  'createdAt',
  'updatedAt',
] as const) {}

class WorkChapterDetailBodyDto extends IntersectionType(
  WorkChapterDetailBodyBaseDto,
  PurchasePricingFieldsDto,
) {}

/**
 * 漫画章节内容 DTO。
 */
export class ComicChapterContentDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkChapterDto, ['title', 'subtitle'] as const),
) {
  @ArrayProperty({
    description: '章节图片内容',
    itemType: 'string',
    required: true,
    validation: false,
  })
  content!: string[]
}

/**
 * 小说章节内容 DTO。
 */
export class NovelChapterContentDto extends IntersectionType(
  IdDto,
  OmitType(ComicChapterContentDto, ['content'] as const),
  PickType(BaseWorkChapterDto, ['content'] as const),
) {}

/**
 * 作品章节详情 DTO。
 */
export class WorkChapterDetailWithUserStatusDto extends IntersectionType(
  WorkChapterDetailBodyDto,
  ChapterUserStatusFieldsDto,
) {}
