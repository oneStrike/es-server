import {
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
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
