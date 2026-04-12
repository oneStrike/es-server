import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'

/**
 * 购买价格读模型。
 * 统一承载原价、支付比例、实付价和优惠金额，供章节展示与购买结果复用。
 */
export class PurchasePricingDto {
  @NumberProperty({
    description: '原价',
    example: 30,
    required: true,
    validation: false,
  })
  originalPrice!: number

  @NumberProperty({
    description: '支付比例（1=原价支付，0.9=9折）',
    example: 0.9,
    required: true,
    validation: false,
  })
  payableRate!: number

  @NumberProperty({
    description: '折后实付价',
    example: 27,
    required: true,
    validation: false,
  })
  payablePrice!: number

  @NumberProperty({
    description: '优惠金额',
    example: 3,
    required: true,
    validation: false,
  })
  discountAmount!: number
}

/**
 * 嵌套价格字段 DTO。
 * 用于各类章节、作品和购买记录响应中复用统一的价格结构。
 */
export class PurchasePricingFieldsDto {
  @NestedProperty({
    description: '购买价格信息',
    type: PurchasePricingDto,
    required: false,
    validation: false,
    nullable: true,
  })
  purchasePricing!: PurchasePricingDto | null
}
