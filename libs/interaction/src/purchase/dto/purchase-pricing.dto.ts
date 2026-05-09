import {
  ContentPurchasePricingDto,
  ContentPurchasePricingFieldsDto,
} from '@libs/content/permission/dto/content-purchase-pricing.dto'

/**
 * 购买价格读模型。
 * 购买域保留响应 DTO 名称，字段事实源由内容域价格读模型提供。
 */
export class PurchasePricingDto extends ContentPurchasePricingDto {}

/**
 * 嵌套价格字段 DTO。
 * 用于各类章节、作品和购买记录响应中复用统一的价格结构。
 */
export class PurchasePricingFieldsDto extends ContentPurchasePricingFieldsDto {}
