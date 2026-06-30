/** 等级规则业务域标识，null/undefined 表示默认全局等级域。 */
export type LevelBusiness = string | null | undefined

/** 解析用户有效等级的输入。 */
export interface LevelResolveInput {
  userId: number
  business?: LevelBusiness
}

/** 按经验值反查等级规则的输入。 */
export interface LevelRuleResolveInput {
  experience: number
  business?: LevelBusiness
}

/** 等级每日额度校验输入。 */
export interface DailyQuotaInput {
  userId: number
  business?: LevelBusiness
}

/** 等级购买折扣价格计算输入。 */
export interface PurchasePricingInput {
  userId: number
  originalPrice: number
  business?: LevelBusiness
}

/** 等级购买折扣价格计算结果。 */
export interface LevelPurchasePricing {
  originalPrice: number
  levelPayableRate: string
  levelPayablePrice: number
  levelDiscountAmount: number
}
