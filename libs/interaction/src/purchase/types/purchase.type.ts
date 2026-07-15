import type { IntegrityLockRequest } from '@db/core'
import type { LevelPurchasePricing } from '@libs/growth/level-rule/level-rule.type'
import type { PreparedDiscountCouponReservation } from '../../coupon/types/coupon.type'

/** 每个全新购买事务前完成发现的计价快照与完整锁并集。 */
export interface PreparedPurchaseAttempt {
  readonly originalPrice: number
  readonly levelPricing: LevelPurchasePricing
  readonly coupon?: PreparedDiscountCouponReservation
  readonly paidPrice: number
  readonly lockRequests: readonly IntegrityLockRequest[]
}
