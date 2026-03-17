/**
 * Auto-converted from legacy schema.
 */

import { bigint, boolean, index, integer, pgTable, smallint, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * 聊天会话成员表（仅私聊）
 */
export const chatConversationMember = pgTable("chat_conversation_member", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 会话ID
   */
  conversationId: integer().notNull(),
  /**
   * 用户ID
   */
  userId: integer().notNull(),
  /**
   * 成员角色（1=会话所有者,2=普通成员）
   */
  role: smallint().notNull(),
  /**
   * 加入时间
   */
  joinedAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 离开时间
   */
  leftAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 是否静音
   */
  isMuted: boolean().default(false).notNull(),
  /**
   * 最后已读消息ID
   */
  lastReadMessageId: bigint({ mode: "bigint" }),
  /**
   * 最后已读时间
   */
  lastReadAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 未读数缓存
   */
  unreadCount: integer().default(0).notNull(),
}, (table) => [
    /**
     * 同一会话同一用户唯一
     */
    unique("chat_conversation_member_conversation_id_user_id_key").on(table.conversationId, table.userId),
    /**
     * 会话查询索引
     */
    index("chat_conversation_member_conversation_id_idx").on(table.conversationId),
    /**
     * 未读会话查询索引
     * 注意：PostgreSQL 索引名最大 63 字符，此名称已被自动截断
     */
    index("chat_conversation_member_user_id_unread_count_conversation__idx").on(table.userId, table.unreadCount, table.conversationId),
]);
