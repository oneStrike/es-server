/**
 * 章节购买扣减虚拟币余额的内部入参，供购买域在同一事务内调用。
 */
export interface ConsumeForPurchaseInput {
  userId: number
  amount: number
  purchaseId: number
  paymentMethod: number
  outTradeNo?: string | null
  targetType: number
  targetId: number
}
