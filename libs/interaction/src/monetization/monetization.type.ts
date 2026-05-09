import type { Db } from '@db/core'
import type {
  AdProviderConfigSelect,
  AppAgreementSelect,
  CouponDefinitionSelect,
  CouponRedemptionRecordSelect,
  PaymentOrderSelect,
  PaymentProviderConfigSelect,
  UserCouponInstanceSelect,
} from '@db/schema'
import type {
  AdRewardVerificationDto,
  CreateMembershipPlanDto,
  CreatePaymentOrderBaseDto,
} from './dto/monetization.dto'
import type {
  AdProviderEnum,
  CouponRedemptionTargetTypeEnum,
  PaymentChannelEnum,
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
  PaymentSubscriptionModeEnum,
} from './monetization.constant'

/**
 * 变现模块事务上下文，供需要复用外部事务的 service 方法显式收口。
 */
export type MonetizationTx = Db

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
 * 创建支付订单的内部聚合输入，外部 DTO 字段与业务目标快照在 service 内收敛。
 */
export interface CreatePaymentOrderInput extends CreatePaymentOrderBaseDto {
  orderType: PaymentOrderTypeEnum
  targetId: number
  payableAmount: number
  targetSnapshot: Record<string, unknown>
  subscriptionMode?: PaymentSubscriptionModeEnum
}

/**
 * App 支付结果公共字段集合，防止数据库订单行和 BaseDto 字段直接展开到客户端响应。
 */
export interface PaymentOrderPublicResult {
  orderNo: string
  orderType: PaymentOrderTypeEnum
  status: PaymentOrderStatusEnum
  subscriptionMode: PaymentSubscriptionModeEnum
  payableAmount: number
  clientPayPayload: Record<string, unknown>
}

/** Provider 签名串允许参与规范化的基础字段值。 */
export type SignedFieldValue = string | number | boolean

/**
 * 支付 provider 创建订单所需的订单、配置和客户端场景上下文。
 */
export interface PaymentProviderCreateOrderInput {
  order: PaymentOrderSelect
  config: PaymentProviderConfigSelect
  sceneContext: CreatePaymentOrderBaseDto
}

/**
 * 支付 provider 回调、查询和退款解析所需的订单配置上下文。
 */
export interface PaymentProviderNotifyInput {
  order: PaymentOrderSelect
  config: PaymentProviderConfigSelect
  payload?: Record<string, unknown>
}

/**
 * 支付 provider 已验签回调字段，service 只能消费这里解析出的可信事实。
 */
export interface PaymentProviderParsedNotify {
  providerTradeNo?: string
  paidAmount?: number
  agreementNo?: string
}

/**
 * 支付确认入口上下文，用于 app 侧把订单访问限定在当前用户。
 */
export interface ConfirmPaymentOrderContext {
  userId?: number
}

/**
 * 支付 provider 适配器契约，真实验签和 provider 字段解析必须在适配器内完成。
 */
export interface PaymentProviderAdapter {
  readonly channel: PaymentChannelEnum
  createOrder: (
    input: PaymentProviderCreateOrderInput,
  ) => Record<string, unknown>
  verifyNotify: (input: PaymentProviderNotifyInput) => boolean
  parseNotify: (
    input: PaymentProviderNotifyInput,
  ) => PaymentProviderParsedNotify
  queryOrder: (order: PaymentOrderSelect) => Record<string, unknown>
  refund: (order: PaymentOrderSelect) => Record<string, unknown>
  parseRefundNotify: (input: PaymentProviderNotifyInput) => {
    providerTradeNo?: string
  }
}

/**
 * 激励广告 provider 核查奖励回调所需的配置和客户端 payload。
 */
export interface AdRewardProviderVerifyInput {
  userId: number
  config: AdProviderConfigSelect
  payload: AdRewardVerificationDto
}

/**
 * 激励广告 provider 适配器契约，负责 provider 侧奖励回调验签和字段标准化。
 */
export interface AdRewardProviderAdapter {
  readonly provider: AdProviderEnum
  verifyRewardCallback: (input: AdRewardProviderVerifyInput) => boolean
  parseRewardPayload: (input: AdRewardProviderVerifyInput) => {
    providerRewardId: string
    placementKey: string
  }
}

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

/**
 * 套餐更新时允许局部覆盖创建字段，但必须在 service 内补齐价格约束。
 */
export type MembershipPlanUpdateData = Partial<CreateMembershipPlanDto>

/**
 * 会员权益配置中的开放 JSON 对象，经 service 收窄后才能读取字段。
 */
export type BenefitValueRecord = Record<string, unknown>
