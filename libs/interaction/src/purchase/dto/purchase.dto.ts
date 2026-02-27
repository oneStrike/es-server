import { EnumProperty, NumberProperty, StringProperty } from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { PaymentMethodEnum, PurchaseStatusEnum, PurchaseTargetTypeEnum } from '../purchase.constant'

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
    description: '支付方式：2=余额（积分用于兑换，不用于购买）',
    enum: PaymentMethodEnum,
    example: PaymentMethodEnum.BALANCE,
    required: true,
  })
  paymentMethod!: PaymentMethodEnum
}

export class PurchaseTargetDto extends BaseUserPurchaseRecordDto {
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
