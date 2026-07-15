/**
 * 成功购买唯一事实身份；字段顺序与
 * user_purchase_record_success_unique_idx(targetType, targetId, userId) 一致。
 */
export interface PurchaseSuccessFactIdentity {
  targetType: number
  targetId: number
  userId: number
}

/** 章节购买扣减虚拟币余额的内部入参，供购买域在同一事务内调用。 */
export interface PurchaseConsumptionInput extends PurchaseSuccessFactIdentity {
  amount: number
  purchaseId: number
  paymentMethod: number
  outTradeNo?: string | null
}
