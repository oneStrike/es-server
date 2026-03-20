import { integer, pgTable, timestamp } from 'drizzle-orm/pg-core'

/**
 * 应用用户计数表
 * 承载高频读取的用户聚合读模型字段
 */
export const appUserCount = pgTable(
  'app_user_count',
  {
    /**
     * 用户 ID，同时作为一对一主键
     */
    userId: integer().primaryKey().notNull(),
    /**
     * 发出的评论总数
     */
    commentCount: integer().default(0).notNull(),
    /**
     * 发出的点赞总数
     */
    likeCount: integer().default(0).notNull(),
    /**
     * 发出的收藏总数
     */
    favoriteCount: integer().default(0).notNull(),
    /**
     * 发布的论坛主题总数
     */
    forumTopicCount: integer().default(0).notNull(),
    /**
     * 评论收到的点赞总数
     */
    commentReceivedLikeCount: integer().default(0).notNull(),
    /**
     * 论坛主题收到的点赞总数
     */
    forumTopicReceivedLikeCount: integer().default(0).notNull(),
    /**
     * 论坛主题收到的收藏总数
     */
    forumTopicReceivedFavoriteCount: integer().default(0).notNull(),
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
  () => [],
)

export type AppUserCount = typeof appUserCount.$inferSelect
export type NewAppUserCount = typeof appUserCount.$inferInsert
