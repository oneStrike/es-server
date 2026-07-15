import type { PaymentNotifyEventSelect, PaymentOrderSelect } from '@db/schema'
import type {
  ProviderPaymentNotifyBodyDto,
  ProviderPaymentNotifyHeadersDto,
  ProviderPaymentNotifyQueryDto,
} from '../dto/payment.dto'
import type { PaymentChannelEnum } from '../payment.constant'
import type { PaymentSettlementAfterPersistInput } from './payment-settlement.type'
import type { PaymentTx } from './payment.type'

/** Provider 原生通知入口的 transport 输入。 */
export interface ProviderPaymentNotifyRequest {
  /** Provider 渠道。 */
  channel: PaymentChannelEnum
  /** 已由 transport 归一化的请求头。 */
  headers: ProviderPaymentNotifyHeadersDto
  /** 已由 transport 归一化的查询参数。 */
  query: ProviderPaymentNotifyQueryDto
  /** 已由 transport 归一化的请求体。 */
  body: ProviderPaymentNotifyBodyDto
  /** 微信验签所需的精确原始 body；其他渠道可为空。 */
  rawBody?: string
}

/** Provider 通知处理所需的订单稳定字段投影。 */
export type PaymentNotifyOrderSnapshot = Pick<
  PaymentOrderSelect,
  | 'id'
  | 'orderNo'
  | 'channel'
  | 'paymentScene'
  | 'subscriptionMode'
  | 'status'
  | 'payableAmount'
  | 'paidAmount'
  | 'providerConfigId'
  | 'providerConfigVersionId'
  | 'providerConfigVersion'
  | 'alipayPublicCredentialId'
  | 'wechatApiV3CredentialId'
  | 'credentialVersionRef'
  | 'providerTradeNo'
  | 'orderType'
  | 'targetId'
  | 'userId'
>

/** 通知事件关联订单时需要的最小标识。 */
export type PaymentNotifyEventOrderSnapshot = Pick<
  PaymentOrderSelect,
  'id' | 'orderNo'
>

/** Provider 通知事件去重和状态迁移需要的稳定字段投影。 */
export type PaymentNotifyEventSnapshot = Pick<
  PaymentNotifyEventSelect,
  'id' | 'payloadHash' | 'processStatus' | 'providerEventId' | 'verifyStatus'
>

/** 已验签通知在结算前选择唯一事件记录所需的上下文。 */
export interface PaymentNotifyEventResolutionInput {
  /** 当前原始载荷哈希对应的事件。 */
  currentEvent: PaymentNotifyEventSnapshot
  /** Provider 渠道。 */
  channel: PaymentChannelEnum
  /** 已定位订单标识。 */
  order: PaymentNotifyEventOrderSnapshot
  /** 已验签的 provider 事件标识；协议未提供时为空。 */
  providerEventId: string | undefined
  /** 已验签的第三方交易号。 */
  providerTradeNo: string
}

/** 已验签通知选择事件记录后的后续处理决定。 */
export interface PaymentNotifyEventResolution {
  /** 唯一审计事件记录。 */
  event: PaymentNotifyEventSnapshot
  /** canonical 事件结算成功后必须同步落为重复终态的当前 payload 事件 ID。 */
  duplicateEventId?: number
  /** true 表示可信重复事件，无需再次进入结算。 */
  shouldAcknowledge: boolean
}

/** 传入 provider adapter 的完整原生通知载荷。 */
export interface PaymentProviderNotifyPayload extends Record<string, unknown> {
  /** Provider 回调 body。 */
  body: Record<string, unknown>
  /** Provider 回调 headers。 */
  headers: Record<string, unknown>
  /** Provider 回调 query。 */
  query: Record<string, unknown>
  /** 用于微信验签的原始 body 文本。 */
  rawBody: string | undefined
}

/** 经过敏感字段遮蔽后可安全进入支付通知事件的对象载荷。 */
export type PaymentNotifyRedactedPayload = Record<string, unknown>

/** 同一事务内更新通知事件为成功或幂等状态所需的数据。 */
export interface PaymentNotifyEventProcessedInput {
  /** 必须复用结算事务，禁止改用根 db。 */
  tx: PaymentTx
  /** 唯一通知事件 ID。 */
  eventId: number
  /** 对应订单标识。 */
  order: PaymentNotifyEventOrderSnapshot
  /** 已验签的第三方交易号。 */
  providerTradeNo: string
  /** 是否为已支付订单的幂等确认。 */
  isDuplicate: boolean
}

/** canonical 结算后同步持久化当前重复 payload 事件所需的事务上下文。 */
export interface PaymentNotifyPersistInput {
  /** 当前物理 payload 需在 canonical 成功后标记为重复的事件 ID；不存在时为空。 */
  duplicateEventId: number | undefined
  /** 本次已选择的 canonical 通知事件。 */
  selectedNotifyEvent: PaymentNotifyEventSnapshot
  /** 结算服务在同一事务中提供的提交前上下文。 */
  settlement: PaymentSettlementAfterPersistInput
  /** 已验签的第三方交易号。 */
  verifiedProviderTradeNo: string
}

/** 通知处理失败后更新同一幂等事件所需的数据。 */
export interface PaymentNotifyEventFailedInput {
  /** 唯一通知事件 ID。 */
  eventId: number
  /** 原始错误对象，仅用于归类与脱敏。 */
  error: unknown
  /** 已定位订单；未定位时为空。 */
  order: PaymentNotifyEventOrderSnapshot | null
  /** 已解析但尚未查到订单的订单号。 */
  orderNo: string | undefined
  /** 已解析的第三方交易号。 */
  providerTradeNo: string | undefined
  /** 当前载荷是否已通过验签。 */
  verified: boolean
}
