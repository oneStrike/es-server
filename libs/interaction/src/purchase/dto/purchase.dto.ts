import { ContentTypeEnum } from '@libs/platform/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, OmitType, PickType } from '@nestjs/swagger'
import {
  PaymentMethodEnum,
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from '../purchase.constant'

/**
 * 基础购买记录 DTO
 */
export class BasePurchaseRecordDto extends BaseDto {
  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @EnumProperty({
    description: '目标类型（1=漫画章节，2=小说章节）',
    enum: PurchaseTargetTypeEnum,
    example: PurchaseTargetTypeEnum.COMIC_CHAPTER,
    required: true,
  })
  targetType!: PurchaseTargetTypeEnum

  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
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
    required: false,
  })
  status?: PurchaseStatusEnum

  @EnumProperty({
    description: '支付方式（1=积分）',
    enum: PaymentMethodEnum,
    example: PaymentMethodEnum.POINTS,
    required: true,
  })
  paymentMethod!: PaymentMethodEnum

  @StringProperty({
    description: '第三方支付订单号（如有）',
    example: '2024010123456789',
    required: false,
  })
  outTradeNo?: string
}

/**
 * 购买目标 DTO
 */
export class PurchaseTargetDto extends PickType(BasePurchaseRecordDto, [
  'targetId',
  'targetType',
  'userId',
  'paymentMethod',
  'outTradeNo',
]) {}

/**
 * 购买作品 DTO
 */
export class PurchaseTargetBodyDto extends OmitType(PurchaseTargetDto, [
  'userId',
]) {}

/**
 * 查询已购作品 DTO
 */
export class QueryPurchasedWorkDto extends IntersectionType(
  PageDto,
  PickType(BasePurchaseRecordDto, ['userId', 'targetType', 'status']),
) {
  @NumberProperty({
    description: '作品类型（1=漫画，2=小说）',
    example: 1,
    required: false,
  })
  workType?: number
}

/**
 * 查询已购作品章节 DTO
 */
export class QueryPurchasedWorkChapterDto extends QueryPurchasedWorkDto {
  @NumberProperty({
    description: '作品 ID',
    example: 1,
    required: true,
  })
  workId!: number
}

/**
 * 已购作品信息 DTO
 */
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
    example: 1,
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

export class PurchasedWorkChapterItemDto extends BasePurchaseRecordDto {
  @NestedProperty({
    description: '章节信息',
    type: PurchasedChapterInfoDto,
    required: true,
    validation: false,
  })
  chapter!: PurchasedChapterInfoDto
}
