import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  primaryKey,
  smallint,
  snakeCase,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * 聊天会话成员表（仅私聊）。
 * 读路径高度依赖“活跃成员（leftAt is null）”语义，因此活跃成员查询必须有独立索引支撑。
 */
export const chatConversationMember = snakeCase.table(
  'chat_conversation_member',
  {
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
    joinedAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
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
    lastReadMessageId: bigint({ mode: 'bigint' }),
    /**
     * 最后已读时间
     */
    lastReadAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 未读数缓存
     */
    unreadCount: integer().default(0).notNull(),
  },
  (table) => [
    /**
     * 最后已读消息索引
     */
    index('chat_conversation_member_last_read_message_id_idx').on(
      table.lastReadMessageId,
    ),
    /**
     * 用户会话列表索引
     */
    index('chat_conversation_member_user_id_joined_at_idx').on(
      table.userId,
      table.joinedAt,
      table.conversationId,
    ),
    /**
     * 未读会话查询索引
     */
    index('chat_conversation_member_user_id_unread_count_conversation__idx').on(
      table.userId,
      table.unreadCount,
      table.conversationId,
    ),
    /**
     * 活跃成员列表索引。
     * 覆盖会话列表、消息中心摘要、timeline 等按 userId + leftAt is null 的高频查询。
     */
    index('chat_conversation_member_active_user_idx')
      .on(table.userId, table.conversationId)
      .where(sql`${table.leftAt} is null`),
    /**
     * 活跃未读聚合索引。
     * 覆盖按 userId 统计 unreadCount 且过滤活跃成员的聚合场景。
     */
    index('chat_conversation_member_active_unread_idx')
      .on(table.userId, table.unreadCount, table.conversationId)
      .where(sql`${table.leftAt} is null`),
    /**
     * 会话与用户复合主键
     */
    primaryKey({ columns: [table.conversationId, table.userId] }),
    check(
      'chat_conversation_member_role_valid_chk',
      sql`${table.role} in (1, 2)`,
    ),
  ],
)
