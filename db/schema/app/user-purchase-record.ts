/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  numeric,
  smallint,
  snakeCase,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 用户购买记录表
 * 记录用户对作品、章节等内容的购买操作
 * 支持购买历史查询和消费统计
 */
export const userPurchaseRecord = snakeCase.table(
  'user_purchase_record',
  {
    /**
     * 主键ID（自增）
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 目标类型 1=漫画章节, 2=小说章节
     */
    targetType: smallint().notNull(),
    /**
     * 目标ID（作品ID或章节ID）
     */
    targetId: integer().notNull(),
    /**
     * 用户ID（关联 app_user.id）
     */
    userId: integer().notNull(),
    /**
     * 原价快照
     */
    originalPrice: integer().notNull(),
    /**
     * 实付价格快照
     */
    paidPrice: integer().notNull(),
    /**
     * 支付比例快照（1=原价支付，0.9=9折）
     */
    payableRate: numeric({ precision: 3, scale: 2 }).default('1.00').notNull(),
    /**
     * 折扣金额快照
     */
    discountAmount: integer().default(0).notNull(),
    /**
     * 折扣券实例 ID
     */
    couponInstanceId: integer(),
    /**
     * 折扣来源（0=无折扣, 1=折扣券）
     */
    discountSource: smallint().default(0).notNull(),
    /**
     * 购买状态（1=成功, 2=失败, 3=退款中, 4=已退款）
     */
    status: smallint().default(1).notNull(),
    /**
     * 支付方式（1=余额, 2=支付宝, 3=微信, 4=积分兑换）
     */
    paymentMethod: smallint().notNull(),
    /**
     * 第三方支付订单号
     */
    outTradeNo: varchar({ length: 100 }),
    /**
     * 创建时间（购买时间）
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /**
     * 更新时间
     */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /**
     * 唯一约束：同一用户对同一目标只允许存在一条成功购买记录
     */
    uniqueIndex('user_purchase_record_success_unique_idx')
      .on(table.targetType, table.targetId, table.userId)
      .where(sql`${table.status} = 1`),
    /**
     * 目标类型与目标ID联合索引
     */
    index('user_purchase_record_target_type_target_id_idx').on(
      table.targetType,
      table.targetId,
    ),
    /**
     * 用户ID索引
     */
    index('user_purchase_record_user_id_idx').on(table.userId),
    /**
     * 购买状态索引
     */
    index('user_purchase_record_status_idx').on(table.status),
    /**
     * 创建时间索引
     */
    index('user_purchase_record_created_at_idx').on(table.createdAt),
    /**
     * 用户状态类型时间联合索引
     */
    index('user_purchase_record_user_id_status_target_type_created_at__idx').on(
      table.userId,
      table.status,
      table.targetType,
      table.createdAt,
      table.targetId,
    ),
    check(
      'user_purchase_record_target_type_valid_chk',
      sql`${table.targetType} in (1, 2)`,
    ),
    check(
      'user_purchase_record_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4)`,
    ),
    check(
      'user_purchase_record_payment_method_valid_chk',
      sql`${table.paymentMethod} in (1, 2, 3, 4)`,
    ),
    check(
      'user_purchase_record_original_price_non_negative_chk',
      sql`${table.originalPrice} >= 0`,
    ),
    check(
      'user_purchase_record_paid_price_non_negative_chk',
      sql`${table.paidPrice} >= 0`,
    ),
    check(
      'user_purchase_record_payable_rate_range_chk',
      sql`${table.payableRate} >= 0 and ${table.payableRate} <= 1`,
    ),
    check(
      'user_purchase_record_discount_amount_non_negative_chk',
      sql`${table.discountAmount} >= 0`,
    ),
    check(
      'user_purchase_record_discount_source_valid_chk',
      sql`${table.discountSource} in (0, 1)`,
    ),
  ],
)

export type UserPurchaseRecordSelect = typeof userPurchaseRecord.$inferSelect
export type UserPurchaseRecordInsert = typeof userPurchaseRecord.$inferInsert
