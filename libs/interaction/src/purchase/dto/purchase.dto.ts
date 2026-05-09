import { BaseWorkChapterDto } from '@libs/content/work/chapter/dto/work-chapter.dto'
import { BaseWorkDto } from '@libs/content/work/core/dto/work.dto'
import { WorkTypeEnum } from '@libs/platform/constant'
import {
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto, PageDto } from '@libs/platform/dto'

import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  PaymentMethodEnum,
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from '../purchase.constant'
import { PurchasePricingFieldsDto } from './purchase-pricing.dto'

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

  @EnumProperty({
    description: '购买状态（1=成功；2=失败；3=退款中；4=已退款）',
    enum: PurchaseStatusEnum,
    example: PurchaseStatusEnum.SUCCESS,
    required: false,
  })
  status?: PurchaseStatusEnum

  @EnumProperty({
    description: '支付方式（1=虚拟币余额；2=支付宝；3=微信；4=历史积分购买）',
    enum: PaymentMethodEnum,
    example: PaymentMethodEnum.CURRENCY,
    required: true,
  })
  paymentMethod!: PaymentMethodEnum

  @StringProperty({
    description: '第三方支付订单号（如有）',
    example: '2024010123456789',
    required: false,
  })
  outTradeNo?: string | null

  @NumberProperty({
    description: '折扣金额快照',
    example: 10,
    min: 0,
    required: false,
  })
  discountAmount?: number

  @NumberProperty({
    description: '折扣券实例 ID',
    example: 1,
    required: false,
  })
  couponInstanceId?: number | null

  @NumberProperty({
    description: '折扣来源（0=无折扣；1=折扣券）',
    example: 1,
    min: 0,
    max: 1,
    required: false,
  })
  discountSource?: number
}

export class PurchaseTargetBodyDto extends PickType(BasePurchaseRecordDto, [
  'targetId',
  'targetType',
  'paymentMethod',
  'outTradeNo',
  'couponInstanceId',
] as const) {}

export class PurchaseTargetCommandDto extends IntersectionType(
  PurchaseTargetBodyDto,
  PickType(BasePurchaseRecordDto, ['userId'] as const),
) {}

export class QueryPurchasedWorkDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BasePurchaseRecordDto), ['status'] as const),
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

export class PurchasedWorkChapterItemDto extends IntersectionType(
  BasePurchaseRecordDto,
  PurchasePricingFieldsDto,
) {
  @NestedProperty({
    description: '章节信息',
    type: PurchasedChapterInfoDto,
    required: true,
    validation: false,
    nullable: false,
  })
  chapter!: PurchasedChapterInfoDto
}

export class PurchaseChapterResultDto extends IntersectionType(
  BasePurchaseRecordDto,
  PurchasePricingFieldsDto,
) {}
