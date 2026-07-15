import type { PaymentReconciliationRecordSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'

/** 后台支付对账分页视图需要的记录字段投影。 */
export type PaymentReconciliationPageSource = Pick<
  PaymentReconciliationRecordSelect,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'paymentOrderId'
  | 'orderNo'
  | 'channel'
  | 'mismatchType'
  | 'status'
  | 'localStatus'
  | 'providerStatus'
  | 'providerTradeNo'
  | 'localAmount'
  | 'providerAmount'
  | 'currency'
  | 'evidence'
  | 'handledRemark'
>

/** 受审计已支付修复前必须核验的对账记录字段。 */
export type PaymentRepairReconciliationSnapshot = Pick<
  PaymentReconciliationRecordSelect,
  | 'id'
  | 'localStatus'
  | 'mismatchType'
  | 'orderNo'
  | 'providerAmount'
  | 'providerStatus'
  | 'providerTradeNo'
  | 'status'
>

/** 支付对账分页组合出的 SQL 条件列表。 */
export type PaymentReconciliationConditions = SQL[]

/** 支付对账和修复路径中允许存储或展示的脱敏证据对象。 */
export type PaymentReconciliationEvidence = Record<string, unknown>
