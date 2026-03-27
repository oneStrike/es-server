/**
 * Auto-converted from legacy schema.
 */

import { bigint, boolean, index, integer, pgTable, primaryKey, smallint, timestamp } from "drizzle-orm/pg-core";

/**
 * 聊天会话成员表（仅私聊）
 */
export const chatConversationMember = pgTable("chat_conversation_member", {
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
     * 最后已读消息索引
     */
    index("chat_conversation_member_last_read_message_id_idx").on(table.lastReadMessageId),
    /**
     * 用户会话列表索引
     */
    index("chat_conversation_member_user_id_joined_at_idx").on(table.userId, table.joinedAt, table.conversationId),
    /**
     * 未读会话查询索引
     */
    index("chat_conversation_member_user_id_unread_count_conversation__idx").on(table.userId, table.unreadCount, table.conversationId),
    /**
     * 会话与用户复合主键
     */
    primaryKey({ columns: [table.conversationId, table.userId] }),
]);
