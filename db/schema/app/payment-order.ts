import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 支付订单表。
 * 第三方支付只产生订单，回调成功后再发放虚拟币或 VIP 订阅权益。
 */
export const paymentOrder = snakeCase.table(
  'payment_order',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 站内订单号。 */
    orderNo: varchar({ length: 80 }).notNull(),
    /** 用户 ID。 */
    userId: integer().notNull(),
    /** 订单业务类型（1=虚拟币充值；2=VIP 订阅）。 */
    orderType: smallint().notNull(),
    /** 支付渠道（1=支付宝；2=微信）。 */
    channel: smallint().notNull(),
    /** 支付场景（1=App；2=H5；3=小程序）。 */
    paymentScene: smallint().notNull(),
    /** 客户端平台（1=Android；2=iOS；3=HarmonyOS；4=Web；5=小程序）。 */
    platform: smallint().notNull(),
    /** 运行环境（1=沙箱；2=正式）。 */
    environment: smallint().notNull(),
    /** 客户端应用键，同一部署内区分多应用。 */
    clientAppKey: varchar({ length: 80 }).default('').notNull(),
    /** 订阅模式（1=一次性；2=自动续费签约首单；3=自动续费代扣订单）。 */
    subscriptionMode: smallint().default(1).notNull(),
    /** 自动续费协议 ID，非自动续费订单为空。 */
    autoRenewAgreementId: integer(),
    /** 订单状态（1=待支付；2=已支付；3=已关闭；4=退款中；5=已退款）。 */
    status: smallint().default(1).notNull(),
    /** 应付金额，单位为分。 */
    payableAmount: integer().notNull(),
    /** 实付金额，单位为分。 */
    paidAmount: integer().default(0).notNull(),
    /** 业务目标 ID，例如充值包 ID 或 VIP 套餐 ID。 */
    targetId: integer().notNull(),
    /** 支付 provider 配置 ID。 */
    providerConfigId: integer().notNull(),
    /** 下单时 provider 配置版本快照。 */
    providerConfigVersion: integer().notNull(),
    /** 下单时密钥版本引用快照。 */
    credentialVersionRef: varchar({ length: 160 }).notNull(),
    /** 配置摘要快照，不包含明文密钥。 */
    configSnapshot: jsonb(),
    /** 客户端上下文，例如 platform、clientAppKey、openId。 */
    clientContext: jsonb(),
    /** 下单时生成的客户端支付参数。 */
    clientPayPayload: jsonb(),
    /** 第三方交易号。 */
    providerTradeNo: varchar({ length: 120 }),
    /** 原始通知 payload。 */
    notifyPayload: jsonb(),
    /** 支付完成时间。 */
    paidAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 关闭时间。 */
    closedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 退款完成时间。 */
    refundedAt: timestamp({ withTimezone: true, precision: 6 }),
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
    unique('payment_order_order_no_key').on(table.orderNo),
    unique('payment_order_provider_trade_no_key').on(table.providerTradeNo),
    index('payment_order_user_status_created_at_idx').on(
      table.userId,
      table.status,
      table.createdAt,
    ),
    index('payment_order_provider_config_status_idx').on(
      table.providerConfigId,
      table.status,
    ),
    check('payment_order_type_valid_chk', sql`${table.orderType} in (1, 2)`),
    check('payment_order_channel_valid_chk', sql`${table.channel} in (1, 2)`),
    check(
      'payment_order_scene_valid_chk',
      sql`${table.paymentScene} in (1, 2, 3)`,
    ),
    check(
      'payment_order_platform_valid_chk',
      sql`${table.platform} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'payment_order_environment_valid_chk',
      sql`${table.environment} in (1, 2)`,
    ),
    check(
      'payment_order_subscription_mode_valid_chk',
      sql`${table.subscriptionMode} in (1, 2, 3)`,
    ),
    check(
      'payment_order_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'payment_order_payable_amount_non_negative_chk',
      sql`${table.payableAmount} >= 0`,
    ),
    check(
      'payment_order_paid_amount_non_negative_chk',
      sql`${table.paidAmount} >= 0`,
    ),
  ],
)

export type PaymentOrderSelect = typeof paymentOrder.$inferSelect
export type PaymentOrderInsert = typeof paymentOrder.$inferInsert
