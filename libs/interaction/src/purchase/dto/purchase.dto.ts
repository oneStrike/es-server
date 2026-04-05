import {
  BaseWorkChapterDto,
  BaseWorkDto,
} from '@libs/content/work'
import { WorkTypeEnum } from '@libs/platform/constant'
import {
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
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
    description: '目标类型（1=漫画章节；2=小说章节）',
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
    description: '购买状态（1=成功；2=失败；3=退款中；4=已退款）',
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
  outTradeNo?: string | null
}

export class PurchaseTargetBodyDto extends PickType(BasePurchaseRecordDto, [
  'targetId',
  'targetType',
  'paymentMethod',
  'outTradeNo',
] as const) {}

export class PurchaseTargetCommandDto extends IntersectionType(
  PurchaseTargetBodyDto,
  PickType(BasePurchaseRecordDto, ['userId'] as const),
) {}

export class QueryPurchasedWorkDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BasePurchaseRecordDto), ['targetType', 'status'] as const),
) {
  @EnumProperty({
    description: '作品类型（1=漫画；2=小说）',
    enum: WorkTypeEnum,
    example: WorkTypeEnum.COMIC,
    required: false,
  })
  workType?: WorkTypeEnum
}

export class QueryPurchasedWorkCommandDto extends IntersectionType(
  QueryPurchasedWorkDto,
  PickType(BasePurchaseRecordDto, ['userId'] as const),
) {}

export class QueryPurchasedWorkChapterDto extends QueryPurchasedWorkDto {
  @NumberProperty({
    description: '作品 ID',
    example: 1,
    required: true,
  })
  workId!: number
}

export class QueryPurchasedWorkChapterCommandDto extends IntersectionType(
  QueryPurchasedWorkChapterDto,
  PickType(BasePurchaseRecordDto, ['userId'] as const),
) {}

export class PurchasedWorkInfoDto extends PickType(BaseWorkDto, [
  'id',
  'type',
  'name',
  'cover',
] as const) {}

export class PurchasedWorkItemDto {
  @NestedProperty({
    description: '作品信息',
    type: PurchasedWorkInfoDto,
    required: true,
    validation: false,
    nullable: false,
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

export class PurchasedChapterInfoDto extends PickType(BaseWorkChapterDto, [
  'id',
  'workId',
  'workType',
  'title',
  'subtitle',
  'cover',
  'sortOrder',
  'isPublished',
  'publishAt',
] as const) {}

export class PurchasedWorkChapterItemDto extends BasePurchaseRecordDto {
  @NestedProperty({
    description: '章节信息',
    type: PurchasedChapterInfoDto,
    required: true,
    validation: false,
    nullable: false,
  })
  chapter!: PurchasedChapterInfoDto
}
