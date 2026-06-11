import type { Db } from '@db/core'
import type {
  PaymentOrderSelect,
  PaymentProviderConfigSelect,
} from '@db/schema'
import type {
  CreatePaymentOrderBaseDto,
  ProviderPaymentNotifyBodyDto,
  ProviderPaymentNotifyHeadersDto,
  ProviderPaymentNotifyQueryDto,
} from '../dto/payment.dto'
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

/**
 * App 只读支付状态字段集合，不能暴露 provider 内部配置、凭据或通知原文。
 */
export interface PaymentOrderStatusResult {
  orderNo: string
  status: PaymentOrderStatusEnum
  orderType: PaymentOrderTypeEnum
  channel: PaymentChannelEnum
  scene: number
  payableAmount: number
  paidAmount: number | null
  currency: string
  expireAt: Date | null
  paidAt: Date | null
  closedAt: Date | null
  clientPayPayload: Record<string, unknown> | null
}

/**
 * Provider 原生通知入口原始请求数据。
 */
export interface ProviderPaymentNotifyRequest {
  channel: PaymentChannelEnum
  headers: ProviderPaymentNotifyHeadersDto
  query: ProviderPaymentNotifyQueryDto
  body: ProviderPaymentNotifyBodyDto
  rawBody?: string
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
  credentialMaterial?: PaymentProviderCredentialMaterial
}

/**
 * 支付 provider 回调、查询和退款解析所需的订单配置上下文。
 */
export interface PaymentProviderNotifyInput {
  order: PaymentOrderSelect
  config: PaymentProviderConfigSelect
  payload?: Record<string, unknown>
  credentialMaterial?: PaymentProviderCredentialMaterial
}

/**
 * 从 provider 原生通知定位站内订单号所需的最小上下文。
 * 微信通知的订单号在加密 resource 内，必须先用候选 APIv3 key 解密。
 */
export interface PaymentProviderNotifyOrderNoInput {
  payload?: Record<string, unknown>
  credentialMaterial?: PaymentProviderCredentialMaterial
}

/**
 * 支付 provider 验签所需的外部凭据材料。
 * 生产实现应由凭据/KMS 解析器按订单不可变版本注入，禁止从 admin 普通 JSON 直接读取明文密钥。
 */
export interface PaymentProviderCredentialMaterial {
  appPrivateKeyPem?: string
  alipayPublicKeyPem?: string
  alipayKeyType?: 'PKCS1' | 'PKCS8'
  wechatApiV3Key?: string
  wechatMerchantSerialNo?: string
  wechatPlatformPublicKeyPem?: string
  wechatPlatformSerialNo?: string
}

/**
 * 支付 provider 已验签回调字段，service 只能消费这里解析出的可信事实。
 */
export interface PaymentProviderParsedNotify {
  providerTradeNo?: string
  paidAmount?: number
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
  ) => Promise<Record<string, unknown>>
  extractNotifyOrderNo: (
    input: PaymentProviderNotifyOrderNoInput,
  ) => string | undefined
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
