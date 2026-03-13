import { ContentTypeEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PickType,
} from '@nestjs/swagger'
import {
  PaymentMethodEnum,
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from '../purchase.constant'

export class BaseUserPurchaseRecordDto extends BaseDto {
  @EnumProperty({
    description: '目标类型（3=漫画章节，4=小说章节）',
    enum: PurchaseTargetTypeEnum,
    example: PurchaseTargetTypeEnum.COMIC_CHAPTER,
    required: true,
  })
  targetType!: PurchaseTargetTypeEnum

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

  @EnumProperty({
    description: '支付方式（1=积分）',
    enum: PaymentMethodEnum,
    example: PaymentMethodEnum.POINTS,
    required: true,
  })
  paymentMethod!: PaymentMethodEnum
}

export class PurchaseTargetDto extends OmitType(
  BaseUserPurchaseRecordDto,
  OMIT_BASE_FIELDS,
) {
  @StringProperty({
    description: '第三方支付订单号（如有）',
    example: '2024010123456789',
    required: false,
  })
  outTradeNo?: string
}

export class QueryPurchasedWorkDto extends IntersectionType(
  PageDto,
  PickType(BaseUserPurchaseRecordDto, ['userId']),
) {
  @EnumProperty({
    description: '作品类型（1=漫画，2=小说）',
    enum: ContentTypeEnum,
    example: ContentTypeEnum.COMIC,
    required: false,
  })
  workType?: ContentTypeEnum

  @EnumProperty({
    description: '购买状态（1=成功，2=失败，3=退款中，4=已退款）',
    enum: PurchaseStatusEnum,
    example: PurchaseStatusEnum.SUCCESS,
    required: false,
  })
  status?: PurchaseStatusEnum
}

export class QueryPurchasedWorkChapterDto extends QueryPurchasedWorkDto {
  @NumberProperty({
    description: '作品 ID',
    example: 1,
    required: true,
  })
  workId!: number
}

export class PurchasedWorkInfoDto {
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

export class PurchasedWorkItemDto {
  @NestedProperty({
    description: '作品信息',
    type: PurchasedWorkInfoDto,
    required: true,
    validation: false,
  })
  work!: PurchasedWorkInfoDto

  @NumberProperty({
    description: '已购章节数',
    example: 12,
    required: true,
    min: 0,
    validation: false,
  })
  purchasedChapterCount!: number

  @DateProperty({
    description: '最近购买时间',
    example: '2026-03-04T09:00:00.000Z',
    required: true,
    validation: false,
  })
  lastPurchasedAt!: Date
}

export class PurchasedWorkPageDto {
  @ArrayProperty({
    description: '已购作品列表',
    itemClass: PurchasedWorkItemDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  list!: PurchasedWorkItemDto[]

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

export class PurchasedChapterInfoDto {
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

export class PurchasedWorkChapterItemDto {
  @NumberProperty({
    description: '购买记录 ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @EnumProperty({
    description: '目标类型（3=漫画章节，4=小说章节）',
    enum: PurchaseTargetTypeEnum,
    example: PurchaseTargetTypeEnum.COMIC_CHAPTER,
    required: true,
    validation: false,
  })
  targetType!: PurchaseTargetTypeEnum

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

  @NumberProperty({
    description: '购买价格',
    example: 20,
    required: true,
    validation: false,
  })
  price!: number

  @EnumProperty({
    description: '购买状态（1=成功，2=失败，3=退款中，4=已退款）',
    enum: PurchaseStatusEnum,
    example: PurchaseStatusEnum.SUCCESS,
    required: true,
    validation: false,
  })
  status!: PurchaseStatusEnum

  @EnumProperty({
    description: '支付方式（1=积分）',
    enum: PaymentMethodEnum,
    example: PaymentMethodEnum.POINTS,
    required: true,
    validation: false,
  })
  paymentMethod!: PaymentMethodEnum

  @StringProperty({
    description: '第三方支付订单号',
    example: '2024010123456789',
    required: false,
    validation: false,
  })
  outTradeNo?: string | null

  @DateProperty({
    description: '购买时间',
    example: '2026-03-04T09:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2026-03-04T09:00:00.000Z',
    required: true,
    validation: false,
  })
  updatedAt!: Date

  @NestedProperty({
    description: '章节信息',
    type: PurchasedChapterInfoDto,
    required: true,
    validation: false,
  })
  chapter!: PurchasedChapterInfoDto
}

export class PurchasedWorkChapterPageDto {
  @ArrayProperty({
    description: '已购章节列表',
    itemClass: PurchasedWorkChapterItemDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  list!: PurchasedWorkChapterItemDto[]

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

export class RefundPurchaseDto extends BaseDto {
  @NumberProperty({
    description: '购买记录 ID',
    example: 1,
    required: true,
  })
  purchaseId!: number

  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
  })
  userId!: number

  @StringProperty({
    description: '退款原因',
    example: '不想要了',
    required: false,
  })
  reason?: string
}
