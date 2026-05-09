import { NestedProperty, NumberProperty } from '@libs/platform/decorators'

/**
 * 内容购买价格读模型。
 * 由内容域拥有，购买、章节展示和作品展示都基于该结构表达当前价格。
 */
export class ContentPurchasePricingDto {
  @NumberProperty({
    description: '原价',
    example: 30,
    required: true,
    validation: false,
  })
  originalPrice!: number

  @NumberProperty({
    description: '支付比例（1=原价支付）',
    example: 1,
    required: true,
    validation: false,
  })
  payableRate!: number

  @NumberProperty({
    description: '实付价',
    example: 30,
    required: true,
    validation: false,
  })
  payablePrice!: number

  @NumberProperty({
    description: '优惠金额',
    example: 0,
    required: true,
    validation: false,
  })
  discountAmount!: number
}

/**
 * 内容购买价格嵌套字段。
 * 用于章节、作品和购买结果响应中复用统一价格结构。
 */
export class ContentPurchasePricingFieldsDto {
  @NestedProperty({
    description: '购买价格信息',
    type: ContentPurchasePricingDto,
    required: false,
    validation: false,
    nullable: true,
  })
  purchasePricing!: ContentPurchasePricingDto | null
}
