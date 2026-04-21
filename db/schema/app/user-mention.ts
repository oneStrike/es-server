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
  unique,
} from 'drizzle-orm/pg-core'
import { check } from 'drizzle-orm/pg-core'

/**
 * 用户提及事实表
 * 统一记录评论与论坛主题中的 @ 用户事实，并标记通知是否已补发。
 */
export const userMention = pgTable(
  'user_mention',
  {
    /**
     * 主键ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 来源类型（1=评论，2=论坛主题）
     */
    sourceType: smallint().notNull(),
    /**
     * 来源ID
     */
    sourceId: integer().notNull(),
    /**
     * 被提及用户ID
     */
    mentionedUserId: integer().notNull(),
    /**
     * 提及开始偏移（基于正文 [start, end)）
     */
    startOffset: integer().notNull(),
    /**
     * 提及结束偏移（基于正文 [start, end)）
     */
    endOffset: integer().notNull(),
    /**
     * 已通知时间
     */
    notifiedAt: timestamp({ withTimezone: true, precision: 6 }),
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
  },
  (table) => [
    unique('user_mention_source_user_offset_key').on(
      table.sourceType,
      table.sourceId,
      table.mentionedUserId,
      table.startOffset,
      table.endOffset,
    ),
    check(
      'user_mention_source_type_valid_chk',
      sql`${table.sourceType} in (1, 2)`,
    ),
    index('user_mention_source_idx').on(table.sourceType, table.sourceId),
    index('user_mention_receiver_created_at_idx').on(
      table.mentionedUserId,
      table.createdAt,
    ),
    index('user_mention_notified_at_idx').on(table.notifiedAt),
  ],
)

export type UserMentionSelect = typeof userMention.$inferSelect
export type UserMentionInsert = typeof userMention.$inferInsert
