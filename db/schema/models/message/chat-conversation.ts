/**
 * Auto-converted from Prisma schema.
 */

import { bigint, index, integer, pgTable, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { appUser } from "../app/app-user";

/**
 * 聊天会话表（仅私聊）
 */
export const chatConversation = pgTable("chat_conversation", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 业务键（direct:{minUserId}:{maxUserId}）
   */
  bizKey: varchar({ length: 100 }).notNull(),
  /**
   * 最后一条消息ID（快照字段）
   */
  lastMessageId: bigint({ mode: "bigint" }),
  /**
   * 最后一条消息时间（快照字段）
   */
  lastMessageAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 最后发言人ID（快照字段）
   */
  lastSenderId: integer().references(() => appUser.id, { onDelete: "set null", onUpdate: "cascade" }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
    /**
     * 业务键唯一
     */
    unique("chat_conversation_biz_key_key").on(table.bizKey),
    /**
     * 会话列表排序索引
     */
    index("chat_conversation_last_message_at_idx").on(table.lastMessageAt.desc()),
]);

