import type { Db } from '@db/core'
import type { AppAgreementSelect } from '@db/schema'
import type { CreateMembershipPlanDto } from '../dto/membership.dto'

/** 会员域事务上下文，供支付结算链路显式透传。 */
export type MembershipTx = Db

/**
 * VIP 协议快照字段，写入订单和自动续费事实时冻结用户下单时看到的协议版本。
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
