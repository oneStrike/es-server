import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 聊天消息表（仅私聊）。
 * 同时承担消息回放、游标分页与会话快照更新的事实源职责。
 */
export const chatMessage = snakeCase.table(
  'chat_message',
  {
    /**
     * 主键ID
     */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 会话ID
     */
    conversationId: integer().notNull(),
    /**
     * 会话内递增序号
     */
    messageSeq: bigint({ mode: 'bigint' }).notNull(),
    /**
     * 发送用户ID
     */
    senderId: integer().notNull(),
    /**
     * 客户端幂等键（同发送者同会话下唯一）
     */
    clientMessageId: varchar({ length: 64 }),
    /**
     * 消息类型（1=文本,2=图片,3=语音,4=视频,99=系统）
     */
    messageType: smallint().notNull(),
    /**
     * 文本内容
     */
    content: text().notNull(),
    /**
     * 正文解析 token 缓存
     * 持久化 EmojiParser 输出，供消息渲染与回放使用
     */
    bodyTokens: jsonb(),
    /**
     * 扩展载荷
     */
    payload: jsonb(),
    /**
     * 消息状态（1=正常,2=撤回,3=删除）
     */
    status: smallint().notNull(),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /**
     * 编辑时间
     */
    editedAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 撤回时间
     */
    revokedAt: timestamp({ withTimezone: true, precision: 6 }),
  },
  (table) => [
    /**
     * 会话内序号唯一
     */
    unique('chat_message_conversation_id_message_seq_key').on(
      table.conversationId,
      table.messageSeq,
    ),
    /**
     * 客户端幂等键唯一约束（允许为空）
     */
    unique('chat_message_conversation_id_sender_id_client_message_id_key').on(
      table.conversationId,
      table.senderId,
      table.clientMessageId,
    ),
    /**
     * 会话消息倒序分页索引
     */
    index('chat_message_conversation_id_created_at_idx').on(
      table.conversationId,
      table.createdAt.desc(),
    ),
    /**
     * 发送者审计索引
     */
    index('chat_message_sender_id_created_at_idx').on(
      table.senderId,
      table.createdAt.desc(),
    ),
    check(
      'chat_message_message_type_valid_chk',
      sql`${table.messageType} in (1, 2, 3, 4, 99)`,
    ),
    check('chat_message_status_valid_chk', sql`${table.status} in (1, 2, 3)`),
  ],
)

export type ChatMessageSelect = typeof chatMessage.$inferSelect
export type ChatMessageInsert = typeof chatMessage.$inferInsert
