import type { DbTransaction } from '@db/core'
import type {
  AppUserSelect,
  CouponDefinitionSelect,
  CouponRedemptionRecordSelect,
  UserCouponInstanceSelect,
} from '@db/schema'

import type {
  CouponRedemptionTargetTypeEnum,
  CouponSourceTypeEnum,
  CouponTargetScopeEnum,
  CouponTypeEnum,
} from '../coupon.constant'

/** 券域事务上下文，供购买和核销链路显式透传。 */
export type CouponTx = DbTransaction

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
  name: string
  targetScope: CouponDefinitionSelect['targetScope']
  discountAmount: CouponDefinitionSelect['discountAmount']
  discountRateBps: CouponDefinitionSelect['discountRateBps']
  validDays: CouponDefinitionSelect['validDays']
  benefitDays: CouponDefinitionSelect['benefitDays']
  benefitCount: CouponDefinitionSelect['benefitCount']
  grantSnapshot: UserCouponInstanceSelect['grantSnapshot']
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
  targetId: number | null
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

/** 已发券实例持有的闭合发放快照。 */
export interface CouponGrantSnapshot {
  name: string
  couponType: CouponTypeEnum
  targetScope: CouponTargetScopeEnum
  usageLimit: number
  discountRateBps: number
  discountAmount: number
  benefitDays: number
  benefitCount: number
  validDays: number
  issuedAt: string
}

/** 通用发券输入，会员、任务和后台发放都通过它进入券域。 */
export interface GrantCouponsForSourceInput {
  userId: number
  couponDefinitionId: number
  sourceType: CouponSourceTypeEnum
  sourceId?: number | null
  quantity?: number
  validDays?: number | null
  grantKeys?: string[]
}

/**
 * 通用发券聚合结果。调用方只依赖实际新建数量；不保留整批券实例行，避免大批量
 * 发券在事务内累积无消费价值的返回对象。
 */
export interface GrantCouponsForSourceResult {
  createdCount: number
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

/** 券定义中可由规则归一化函数校正的可写字段集合。 */
export interface WritableCouponDefinition {
  couponType: CouponTypeEnum
  targetScope: CouponTargetScopeEnum
  usageLimit: number
  discountAmount: number
  discountRateBps: number
  benefitDays: number
  benefitCount: number
}

/** 券能力校验所需的规则字段视图。 */
export type CouponAbilityDefinition = WritableCouponDefinition

/** 券发放快照构造所需的券定义字段视图。 */
export type CouponGrantSnapshotSource = Omit<CouponGrantSnapshot, 'issuedAt'>

/** 批量发券 workflow 条目错误事实结构，供条目页和错误持久化读取复用。 */
export interface CouponAdminGrantErrorFacts {
  code: string
  context: Record<string, unknown>
  domain: string
  retryable: boolean
  severity: string
  stage: string
}

/** 批量发券 workflow 任务与 attempt 通用计数字段。 */
export interface CouponAdminGrantItemCounters {
  failedItemCount: number
  skippedItemCount: number
  successItemCount: number
}

/** 券定义更新入参，排除 ID 字段。 */
export type CouponDefinitionUpdateInput = Omit<
  import('../dto/coupon.dto').UpdateCouponDefinitionDto,
  'id'
>

/** 券发放用户标签引用，仅承载展示所需的最小字段。 */
export type CouponGrantUserRef = Pick<
  AppUserSelect,
  'account' | 'nickname' | 'phoneNumber'
>
