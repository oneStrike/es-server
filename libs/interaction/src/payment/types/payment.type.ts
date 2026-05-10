import type { Db } from '@db/core'
import type {
  PaymentOrderSelect,
  PaymentProviderConfigSelect,
} from '@db/schema'
import type { CreatePaymentOrderBaseDto } from '../dto/payment.dto'
import type {
  PaymentChannelEnum,
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
  PaymentSubscriptionModeEnum,
} from '../payment.constant'

/** 支付域事务上下文，供结算链路显式透传。 */
export type PaymentTx = Db

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
 * 支付 provider 本地验签所需的稳定字段、密钥和签名输入。
 */
export interface PaymentProviderSignatureInput {
  fields: Record<string, SignedFieldValue>
  secret: string
  signature: string
}

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
 * 支付 provider 退款回调中对账所需的已标准化字段。
 */
export interface PaymentRefundParsedNotify {
  providerTradeNo?: string
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
  parseRefundNotify: (
    input: PaymentProviderNotifyInput,
  ) => PaymentRefundParsedNotify
}
