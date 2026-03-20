import { index, integer, pgTable, timestamp } from 'drizzle-orm/pg-core'

/**
 * 应用用户计数表
 * 承载跨项目可复用的用户计数扩展字段
 */
export const appUserCount = pgTable(
  'app_user_count',
  {
    /**
     * 用户 ID，同时作为一对一主键
     */
    userId: integer().primaryKey().notNull(),
    /**
     * 论坛主题数
     */
    forumTopicCount: integer().default(0).notNull(),
    /**
     * 论坛回复数
     */
    forumReplyCount: integer().default(0).notNull(),
    /**
     * 论坛收到的点赞数
     */
    forumReceivedLikeCount: integer().default(0).notNull(),
    /**
     * 论坛收到的收藏数
     */
    forumReceivedFavoriteCount: integer().default(0).notNull(),
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
    index('app_user_count_forum_topic_count_idx').on(table.forumTopicCount),
    index('app_user_count_forum_reply_count_idx').on(table.forumReplyCount),
    index('app_user_count_forum_received_like_count_idx').on(
      table.forumReceivedLikeCount,
    ),
    index('app_user_count_forum_received_favorite_count_idx').on(
      table.forumReceivedFavoriteCount,
    ),
    index('app_user_count_created_at_idx').on(table.createdAt),
  ],
)

export type AppUserCount = typeof appUserCount.$inferSelect
export type NewAppUserCount = typeof appUserCount.$inferInsert
