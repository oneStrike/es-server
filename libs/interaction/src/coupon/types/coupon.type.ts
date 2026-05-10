import type { Db } from '@db/core'
import type {
  CouponDefinitionSelect,
  CouponRedemptionRecordSelect,
  UserCouponInstanceSelect,
} from '@db/schema'
import type { CouponRedemptionTargetTypeEnum } from '../coupon.constant'

/** 券域事务上下文，供购买和核销链路显式透传。 */
export type CouponTx = Db

/**
 * 可核销券实例与券定义的合并视图，只服务核销事务内部校验。
 */
export interface CouponInstanceWithDefinition {
  id: UserCouponInstanceSelect['id']
  userId: UserCouponInstanceSelect['userId']
  couponDefinitionId: UserCouponInstanceSelect['couponDefinitionId']
  couponType: UserCouponInstanceSelect['couponType']
  status: UserCouponInstanceSelect['status']
  remainingUses: UserCouponInstanceSelect['remainingUses']
  expiresAt: UserCouponInstanceSelect['expiresAt']
  name: CouponDefinitionSelect['name']
  targetScope: CouponDefinitionSelect['targetScope']
  discountAmount: CouponDefinitionSelect['discountAmount']
  discountRateBps: CouponDefinitionSelect['discountRateBps']
  validDays: CouponDefinitionSelect['validDays']
}

/**
 * 查找可核销券实例的最小身份字段。
 */
export interface CouponInstanceLookupInput {
  userId: number
  couponInstanceId: number
}

/**
 * 扣减券次数并写入核销记录所需的事务输入。
 */
export interface ConsumeCouponRedemptionInput {
  userId: number
  couponInstanceId: number
  targetType: CouponRedemptionTargetTypeEnum
  targetId: number
  coupon: CouponInstanceWithDefinition
  bizKey: string
  redemptionSnapshot: Record<string, unknown>
}

/**
 * 券核销幂等结果，created 控制后续权益发放副作用是否允许执行。
 */
export interface ConsumeCouponRedemptionResult {
  redemption: CouponRedemptionRecordSelect
  created: boolean
}

/**
 * 折扣券预留输入，购买流程在同一事务中消费它并复用核销记录。
 */
export interface ReserveDiscountCouponInput {
  userId: number
  couponInstanceId: number
  targetType: CouponRedemptionTargetTypeEnum
  targetId: number
  originalPrice: number
}
