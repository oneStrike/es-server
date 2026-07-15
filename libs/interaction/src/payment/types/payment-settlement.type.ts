import type { PaymentOrderSelect } from '@db/schema'
import type { PreparedPaidOrderActivation } from '../../membership/types/membership.type'
import type { PaymentOrderPublicResult, PaymentTx } from './payment.type'

/** 支付结算推进所需的订单稳定字段，覆盖订单状态、金额、履约目标与审计标识。 */
export type PaymentSettlementOrder = Pick<
  PaymentOrderSelect,
  | 'id'
  | 'orderNo'
  | 'orderType'
  | 'subscriptionMode'
  | 'status'
  | 'payableAmount'
  | 'paidAmount'
  | 'providerTradeNo'
  | 'targetId'
  | 'userId'
  | 'providerConfigId'
  | 'providerConfigVersion'
>

/** 已提交或幂等命中的支付结算结果，供通知事件在相同事务中落库。 */
export interface PaymentSettlementResult {
  /** 已支付订单完整行。 */
  order: PaymentOrderSelect
  /** 是否命中已支付幂等分支。 */
  isDuplicate: boolean
}

/** 已支付结算结果中允许继续履约和记录通知事件的完整订单行。 */
export type PaymentSettlementPaidOrder = PaymentSettlementResult['order']

/** 结算写入后、事务提交前的回调上下文，禁止在回调中改用根 db。 */
export interface PaymentSettlementAfterPersistInput {
  /** 结算唯一事务上下文。 */
  tx: PaymentTx
  /** 本次结算状态结果。 */
  result: PaymentSettlementResult
}

/** 通知等调用方在结算同一事务中追加事实记录的回调。 */
export type PaymentSettlementAfterPersist = (
  input: PaymentSettlementAfterPersistInput,
) => Promise<void>

/** 已验签支付事实进入结算服务的命令。 */
export interface SettleVerifiedPaymentInput {
  /** 当前订单稳定快照。 */
  order: PaymentSettlementOrder
  /** 已验签实付金额，单位为分。 */
  paidAmount: number
  /** 已验签第三方交易号。 */
  providerTradeNo: string
  /** 已脱敏或受审计的通知载荷。 */
  notifyPayload: Record<string, unknown> | null
  /** 订单状态不允许推进时的明确业务错误文案。 */
  stateConflictMessage: string
  /** 与结算一起提交的附加事实写入。 */
  afterPersist?: PaymentSettlementAfterPersist
}

/** 会员履约锁准备与事务执行之间的显式上下文。 */
export interface PaymentSettlementExecutionContext {
  /** 支付结算唯一事务上下文。 */
  tx: PaymentTx
  /** VIP 订单已准备的锁计划；非 VIP 时为空。 */
  membershipActivation: PreparedPaidOrderActivation | undefined
}

/** 支付结算唯一事务内执行的命名回调。 */
export type PaymentSettlementExecutor<TResult> = (
  context: PaymentSettlementExecutionContext,
) => Promise<TResult>

/** 后台或修复入口对支付订单的最小公开确认结果。 */
export type PaymentSettlementPublicResult = PaymentOrderPublicResult
