import type { DbTransaction } from '@db/core'
import type { CouponRedemptionTargetTypeEnum } from '../coupon.constant'

/** 阅读券核销后写入内容权益的券事实快照。 */
export interface CouponReadingEntitlementGrantSnapshot {
  couponInstanceId: number
  couponDefinitionId: number
  redemptionRecordId: number
}

/** 阅读券核销后写入内容权益所需的冻结事实。 */
export interface GrantCouponReadingEntitlementInput {
  userId: number
  targetType: CouponRedemptionTargetTypeEnum
  targetId: number
  sourceId: number
  sourceKey: string
  expiresAt: Date | null
  grantSnapshot: CouponReadingEntitlementGrantSnapshot
}

/**
 * 券域消费内容域能力的最小同步端口。
 * 券核销是事务 owner，内容适配器必须使用传入事务写入权益，不能自行开启事务。
 */
export interface CouponContentPort {
  grantReadingEntitlement: (
    tx: DbTransaction,
    input: GrantCouponReadingEntitlementInput,
  ) => Promise<void>
}
