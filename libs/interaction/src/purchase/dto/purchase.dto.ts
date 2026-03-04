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
import { BaseDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  PaymentMethodEnum,
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from '../purchase.constant'

export class BaseUserPurchaseRecordDto extends BaseDto {
  @EnumProperty({
    description: '目标类型：1=漫画, 2=小说, 3=漫画章节, 4=小说章节',
    enum: PurchaseTargetTypeEnum,
    example: 1,
    required: true,
  })
  targetType!: PurchaseTargetTypeEnum

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

  @EnumProperty({
    description: '支付方式：1=积分',
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
    description: '第三方支付订单号（支付宝/微信支付时使用）',
    example: '2024010123456789',
    required: false,
  })
  outTradeNo?: string
}

export class QueryUserPurchaseRecordDto extends IntersectionType(
  IntersectionType(
    PageDto,
    PartialType(PickType(BaseUserPurchaseRecordDto, ['targetType'])),
  ),
  PickType(BaseUserPurchaseRecordDto, ['userId']),
) {
  @EnumProperty({
    description: '购买状态：1=成功, 2=失败, 3=退款中, 4=已退款',
    enum: PurchaseStatusEnum,
    example: 1,
    required: false,
  })
  status?: PurchaseStatusEnum
}

export class QueryPurchasedWorkDto extends IntersectionType(
  PageDto,
  PickType(BaseUserPurchaseRecordDto, ['userId']),
) {
  @EnumProperty({
    description: '作品类型：1=漫画, 2=小说',
    enum: WorkTypeEnum,
    example: WorkTypeEnum.COMIC,
    required: false,
  })
  workType?: WorkTypeEnum

  @EnumProperty({
    description: '购买状态：1=成功, 2=失败, 3=退款中, 4=已退款',
    enum: PurchaseStatusEnum,
    example: PurchaseStatusEnum.SUCCESS,
    required: false,
  })
  status?: PurchaseStatusEnum
}

export class QueryPurchasedWorkChapterDto extends QueryPurchasedWorkDto {
  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
  })
  workId!: number
}

export class PurchaseChapterDto extends BaseDto {
  @EnumProperty({
    description: '作品类型：1=漫画, 2=小说',
    enum: WorkTypeEnum,
    example: WorkTypeEnum.COMIC,
    required: true,
  })
  workType!: WorkTypeEnum

  @NumberProperty({
    description: '章节ID',
    example: 1,
    required: true,
  })
  chapterId!: number
}

export class PurchasedWorkInfoDto {
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

export class PurchasedChapterInfoDto {
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

export class PurchasedWorkChapterItemDto {
  @NumberProperty({
    description: '购买记录ID',
    example: 1,
    required: true,
  })
  id!: number

  @EnumProperty({
    description: '目标类型：1=漫画章节, 2=小说章节',
    enum: PurchaseTargetTypeEnum,
    example: PurchaseTargetTypeEnum.COMIC_CHAPTER,
    required: true,
  })
  targetType!: PurchaseTargetTypeEnum

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

  @NumberProperty({
    description: '购买价格',
    example: 20,
    required: true,
  })
  price!: number

  @EnumProperty({
    description: '购买状态：1=成功, 2=失败, 3=退款中, 4=已退款',
    enum: PurchaseStatusEnum,
    example: PurchaseStatusEnum.SUCCESS,
    required: true,
  })
  status!: PurchaseStatusEnum

  @EnumProperty({
    description: '支付方式：1=积分',
    enum: PaymentMethodEnum,
    example: PaymentMethodEnum.POINTS,
    required: true,
  })
  paymentMethod!: PaymentMethodEnum

  @StringProperty({
    description: '第三方支付订单号',
    example: '2024010123456789',
    required: false,
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

export class RefundPurchaseDto extends BaseDto {
  @NumberProperty({
    description: '购买记录ID',
    example: 1,
    required: true,
  })
  purchaseId!: number

  @NumberProperty({
    description: '用户ID',
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
