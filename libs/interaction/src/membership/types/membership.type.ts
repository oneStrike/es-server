import type { DbTransaction, IntegrityLockRequest } from '@db/core'
import type {
  AppAgreementSelect,
  MembershipPlanSelect,
  PaymentOrderSelect,
} from '@db/schema'
import type { CreateMembershipPlanDto } from '../dto/membership.dto'

/** 会员域事务上下文，供支付结算链路显式透传。 */
export type MembershipTx = DbTransaction

/**
 * VIP 协议快照字段，写入订单时冻结用户下单时看到的协议版本。
 */
export type MembershipAgreementSnapshot = Pick<
  AppAgreementSelect,
  'id' | 'title' | 'version' | 'isForce' | 'publishedAt'
>

/**
 * 会员订阅页协议读取选项，仅用于区分 admin 配置视图与 app 公开视图。
 */
export interface MembershipPageAgreementQueryOptions {
  publishedOnly?: boolean
}

/**
 * 需要补充协议列表的会员订阅页最小身份字段。
 */
export interface MembershipPageConfigIdentity {
  id: number
}

/**
 * 套餐更新时允许局部覆盖创建字段，但必须在 service 内补齐价格约束。
 */
export type MembershipPlanUpdateData = Partial<CreateMembershipPlanDto>

/**
 * 会员权益配置中的开放 JSON 对象，经 service 收窄后才能读取字段。
 */
export type BenefitValueRecord = Record<string, unknown>

/** 支付履约冻结的套餐字段，只保留订阅、积分与券权益实际消费的数据。 */
export type PaidOrderActivationPlanSnapshot = Pick<
  MembershipPlanSelect,
  'id' | 'planKey' | 'tier' | 'durationDays' | 'bonusPointAmount'
>

/** 支付履约归一化后的单项券权益，不暴露开放 JSON 配置。 */
export interface PaidOrderCouponBenefitGrant {
  readonly planBenefitId: number
  readonly couponDefinitionId: number
  readonly quantity: number
  readonly validDays?: number
}

/** 支付事务外发现的完整会员履约锁计划与权威重读快照。 */
export interface PreparedPaidOrderActivation {
  readonly plan: PaidOrderActivationPlanSnapshot
  readonly couponBenefits: readonly PaidOrderCouponBenefitGrant[]
  readonly lockRequests: readonly IntegrityLockRequest[]
}

/** 会员支付履约只依赖订单稳定事实，避免要求调用方展开整行类型。 */
export type PaidOrderActivationOrder = Pick<
  PaymentOrderSelect,
  'id' | 'orderNo' | 'orderType' | 'paidAmount' | 'targetId' | 'userId'
>
