/**
 * Auto-converted from Prisma schema.
 */

import { bigint, index, integer, jsonb, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 消息投递外盒表
 * 用于保障通知/聊天事件可靠异步投递
 */
export const messageOutbox = pgTable("message_outbox", {
  /**
   * 主键ID
   */
  id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 事件域（1=通知,2=聊天）
   */
  domain: smallint().notNull(),
  /**
   * 事件类型（按业务枚举定义，使用 SmallInt）
   */
  eventType: smallint().notNull(),
  /**
   * 全局幂等业务键
   */
  bizKey: varchar({ length: 180 }).notNull(),
  /**
   * 事件载荷
   */
  payload: jsonb().notNull(),
  /**
   * 投递状态（1=待处理,2=处理中,3=成功,4=失败）
   */
  status: smallint().default(1).notNull(),
  /**
   * 重试次数
   */
  retryCount: integer().default(0).notNull(),
  /**
   * 下次重试时间
   */
  nextRetryAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 最后错误信息
   */
  lastError: varchar({ length: 500 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 处理完成时间
   */
  processedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
    /**
     * 唯一约束：全局幂等
     */
    unique("message_outbox_biz_key_key").on(table.bizKey),
    /**
     * 消费轮询索引
     */
    index("message_outbox_status_next_retry_at_id_idx").on(table.status, table.nextRetryAt, table.id),
    /**
     * 监控索引
     */
    index("message_outbox_domain_status_created_at_idx").on(table.domain, table.status, table.createdAt),
]);
