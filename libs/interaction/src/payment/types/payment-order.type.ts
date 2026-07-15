import type {
  PaymentOrderSelect,
  PaymentProviderConfigSelect,
} from '@db/schema'
import type { PaymentProviderOrderSnapshot } from './payment.type'

/** 下单后生成客户端支付参数时需要的订单不可变快照。 */
export type PaymentOrderCreateSnapshot = PaymentProviderOrderSnapshot &
  Pick<PaymentOrderSelect, 'id' | 'orderType' | 'subscriptionMode'>

/** App 下单响应可公开的最小订单字段投影。 */
export type PaymentOrderPublicResultSource = Pick<
  PaymentOrderSelect,
  'orderNo' | 'orderType' | 'payableAmount' | 'status' | 'subscriptionMode'
>

/** 订单创建时选择的当前 provider 配置完整快照。 */
export type PaymentProviderConfigOrderSnapshot = Pick<
  PaymentProviderConfigSelect,
  'allowedReturnDomains' | 'configVersion' | 'id' | 'paymentScene'
>

/** 后台支付订单分页视图需要的订单字段投影。 */
export type AdminPaymentOrderPageSource = Pick<
  PaymentOrderSelect,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'orderNo'
  | 'userId'
  | 'orderType'
  | 'channel'
  | 'paymentScene'
  | 'platform'
  | 'environment'
  | 'clientAppKey'
  | 'subscriptionMode'
  | 'status'
  | 'payableAmount'
  | 'paidAmount'
  | 'targetId'
  | 'providerConfigId'
  | 'providerConfigVersion'
  | 'configSnapshot'
  | 'providerTradeNo'
  | 'paidAt'
  | 'closedAt'
  | 'refundedAt'
>

/** 从订单配置快照构建后台账号展示名所需的字段。 */
export type PaymentProviderAccountLabelOrderSource = Pick<
  PaymentOrderSelect,
  'id' | 'providerConfigId' | 'configSnapshot'
>

/** App 查询订单状态时允许读取的最小订单字段投影。 */
export type AppPaymentOrderStatusSource = Pick<
  PaymentOrderSelect,
  | 'userId'
  | 'orderNo'
  | 'status'
  | 'orderType'
  | 'channel'
  | 'paymentScene'
  | 'payableAmount'
  | 'paidAmount'
  | 'paidAt'
  | 'closedAt'
  | 'clientPayPayload'
>
