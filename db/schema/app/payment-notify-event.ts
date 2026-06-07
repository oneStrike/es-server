import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 支付 provider 通知事件表。
 * 记录验签、去重、处理状态和脱敏 payload，作为支付事实审计来源。
 */
export const paymentNotifyEvent = snakeCase.table(
  'payment_notify_event',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 支付渠道（1=支付宝；2=微信）。 */
    channel: smallint().notNull(),
    /** 通知类型（1=支付成功；2=支付失败；3=关闭；4=未知）。 */
    eventType: smallint().default(4).notNull(),
    /** 支付订单 ID，无法关联订单时为空。 */
    paymentOrderId: integer(),
    /** 站内订单号。 */
    orderNo: varchar({ length: 80 }),
    /** 第三方交易号。 */
    providerTradeNo: varchar({ length: 120 }),
    /** provider 事件 ID。 */
    providerEventId: varchar({ length: 160 }),
    /** 原始 payload 哈希。 */
    payloadHash: varchar({ length: 128 }).notNull(),
    /** 请求头快照，必须脱敏。 */
    headers: jsonb(),
    /** 原始 payload 的脱敏副本。 */
    redactedPayload: jsonb(),
    /** 验签状态（1=待验签；2=成功；3=失败）。 */
    verifyStatus: smallint().default(1).notNull(),
    /** 处理状态（1=待处理；2=已处理；3=重复；4=失败）。 */
    processStatus: smallint().default(1).notNull(),
    /** 错误编码。 */
    errorCode: varchar({ length: 80 }),
    /** 错误摘要，禁止写入密钥或完整 payload。 */
    errorMessage: varchar({ length: 500 }),
    /** 接收时间。 */
    receivedAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 处理时间。 */
    processedAt: timestamp({ withTimezone: true, precision: 6 }),
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
    uniqueIndex('payment_notify_event_provider_event_key')
      .on(table.channel, table.providerEventId)
      .where(sql`${table.providerEventId} is not null`),
    uniqueIndex('payment_notify_event_payload_hash_key').on(
      table.channel,
      table.payloadHash,
    ),
    index('payment_notify_event_order_idx').on(table.orderNo, table.createdAt),
    index('payment_notify_event_trade_idx').on(
      table.providerTradeNo,
      table.createdAt,
    ),
    index('payment_notify_event_status_idx').on(
      table.verifyStatus,
      table.processStatus,
      table.createdAt,
    ),
    check(
      'payment_notify_event_channel_valid_chk',
      sql`${table.channel} in (1, 2)`,
    ),
    check(
      'payment_notify_event_type_valid_chk',
      sql`${table.eventType} in (1, 2, 3, 4)`,
    ),
    check(
      'payment_notify_event_verify_status_valid_chk',
      sql`${table.verifyStatus} in (1, 2, 3)`,
    ),
    check(
      'payment_notify_event_process_status_valid_chk',
      sql`${table.processStatus} in (1, 2, 3, 4)`,
    ),
  ],
)

export type PaymentNotifyEventSelect = typeof paymentNotifyEvent.$inferSelect
export type PaymentNotifyEventInsert = typeof paymentNotifyEvent.$inferInsert
