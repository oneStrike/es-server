import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 支付对账记录表。
 * 记录本地订单与 provider 查询结果差异，退款差异仅展示不执行。
 */
export const paymentReconciliationRecord = snakeCase.table(
  'payment_reconciliation_record',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 支付订单 ID。 */
    paymentOrderId: integer(),
    /** 站内订单号。 */
    orderNo: varchar({ length: 80 }).notNull(),
    /** 支付渠道（1=支付宝；2=微信）。 */
    channel: smallint().notNull(),
    /** 差异类型（1=本地已支付 provider 未支付；2=本地待支付 provider 已支付；3=金额不一致；4=重复交易号；5=验签失败；6=退款差异）。 */
    mismatchType: smallint().notNull(),
    /** 对账状态（1=待处理；2=已确认；3=已修复；4=忽略）。 */
    status: smallint().default(1).notNull(),
    /** 本地订单状态。 */
    localStatus: smallint().notNull(),
    /** provider 订单状态。 */
    providerStatus: varchar({ length: 80 }).default('').notNull(),
    /** 第三方交易号。 */
    providerTradeNo: varchar({ length: 120 }),
    /** 本地金额，单位为分。 */
    localAmount: integer().notNull(),
    /** provider 金额，单位为分。 */
    providerAmount: integer(),
    /** 币种。 */
    currency: varchar({ length: 16 }).default('CNY').notNull(),
    /** 对账证据摘要，必须脱敏。 */
    evidence: jsonb(),
    /** 处理备注。 */
    handledRemark: varchar({ length: 500 }),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('payment_reconciliation_record_status_created_at_idx').on(
      table.status,
      table.createdAt,
      table.id,
    ),
    index('payment_reconciliation_record_order_idx').on(
      table.orderNo,
      table.createdAt,
    ),
    index('payment_reconciliation_record_payment_order_id_idx').on(
      table.paymentOrderId,
    ),
    index('payment_reconciliation_record_channel_status_idx').on(
      table.channel,
      table.status,
      table.createdAt,
    ),
    index('payment_reconciliation_record_mismatch_status_idx').on(
      table.mismatchType,
      table.status,
      table.createdAt,
    ),
    check(
      'payment_reconciliation_record_channel_valid_chk',
      sql`${table.channel} in (1, 2)`,
    ),
    check(
      'payment_reconciliation_record_mismatch_type_valid_chk',
      sql`${table.mismatchType} in (1, 2, 3, 4, 5, 6)`,
    ),
    check(
      'payment_reconciliation_record_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4)`,
    ),
  ],
)

export type PaymentReconciliationRecordSelect =
  typeof paymentReconciliationRecord.$inferSelect
export type PaymentReconciliationRecordInsert =
  typeof paymentReconciliationRecord.$inferInsert
