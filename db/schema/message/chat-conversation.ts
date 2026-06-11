import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 聊天会话表（仅私聊）。
 * 主要承载会话级快照字段，供会话列表与消息中心快速读取。
 */
export const chatConversation = snakeCase.table(
  'chat_conversation',
  {
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
    lastMessageId: bigint({ mode: 'bigint' }),
    /**
     * 最后一条消息时间（快照字段）
     */
    lastMessageAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 最后发言人ID（快照字段）
     */
    lastSenderId: integer(),
    /**
     * 是否曾经成功发送过消息
     */
    hasMessages: boolean().default(false).notNull(),
    /**
     * 创建时间
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
    /**
     * 保留截止时间；仅隐藏且无保留消息的会话可进入清理窗口。
     */
    retentionUntil: timestamp({ withTimezone: true, precision: 6 }).default(
      sql`now() + interval '365 days'`,
    ),
    /**
     * 归档时间；为空表示仍处于热数据窗口。
     */
    archivedAt: timestamp({ withTimezone: true, precision: 6 }),
  },
  (table) => [
    /**
     * 业务键唯一
     */
    unique('chat_conversation_biz_key_key').on(table.bizKey),
    /**
     * 会话列表排序索引
     */
    index('chat_conversation_last_message_at_idx').on(
      table.lastMessageAt.desc(),
    ),
    index('chat_conversation_last_message_at_id_idx').on(
      table.lastMessageAt.desc(),
      table.id.desc(),
    ),
    index('chat_conversation_retention_until_id_idx').on(
      table.retentionUntil,
      table.id,
    ),
    /**
     * 最后一条消息索引
     */
    index('chat_conversation_last_message_id_idx').on(table.lastMessageId),
    /**
     * 最后发言人关联索引。
     */
    index('chat_conversation_last_sender_id_idx').on(table.lastSenderId),
  ],
)
