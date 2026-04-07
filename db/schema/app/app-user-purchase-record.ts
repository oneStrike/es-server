/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 用户购买记录表
 * 记录用户对作品、章节等内容的购买操作
 * 支持购买历史查询和消费统计
 */
export const appUserPurchaseRecord = pgTable(
  'app_user_purchase_record',
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
     * 购买价格（实际支付金额）
     */
    price: integer().notNull(),
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
    uniqueIndex('app_user_purchase_record_success_unique_idx')
      .on(table.targetType, table.targetId, table.userId)
      .where(sql`${table.status} = 1`),
    /**
     * 目标类型与目标ID联合索引
     */
    index('app_user_purchase_record_target_type_target_id_idx').on(
      table.targetType,
      table.targetId,
    ),
    /**
     * 用户ID索引
     */
    index('app_user_purchase_record_user_id_idx').on(table.userId),
    /**
     * 购买状态索引
     */
    index('app_user_purchase_record_status_idx').on(table.status),
    /**
     * 创建时间索引
     */
    index('app_user_purchase_record_created_at_idx').on(table.createdAt),
    /**
     * 用户状态类型时间联合索引
     */
    index('app_user_purchase_record_user_id_status_target_type_created_at__idx').on(
      table.userId,
      table.status,
      table.targetType,
      table.createdAt,
      table.targetId,
    ),
  ],
)

export type AppUserPurchaseRecordSelect = typeof appUserPurchaseRecord.$inferSelect
export type AppUserPurchaseRecordInsert = typeof appUserPurchaseRecord.$inferInsert
