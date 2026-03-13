/**
 * Auto-converted from Prisma schema.
 */

import { index, integer, pgTable, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 论坛用户资料表 - 存储用户的论坛信息，包括积分、等级、统计数据、签名等
 */
export const forumProfile = pgTable("forum_profile", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 关联的用户ID
   */
  userId: integer().notNull(),
  /**
   * 发表主题数
   */
  topicCount: integer().default(0).notNull(),
  /**
   * 发表回复数
   */
  replyCount: integer().default(0).notNull(),
  /**
   * 获得点赞数
   */
  likeCount: integer().default(0).notNull(),
  /**
   * 获得收藏数
   */
  favoriteCount: integer().default(0).notNull(),
  /**
   * 签名
   */
  signature: varchar({ length: 200 }),
  /**
   * 个人简介
   */
  bio: varchar({ length: 500 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 软删除时间
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
    /**
     * 唯一索引: userId
     */
    unique("forum_profile_user_id_key").on(table.userId),
    /**
     * 主题数索引
     */
    index("forum_profile_topic_count_idx").on(table.topicCount),
    /**
     * 回复数索引
     */
    index("forum_profile_reply_count_idx").on(table.replyCount),
    /**
     * 点赞数索引
     */
    index("forum_profile_like_count_idx").on(table.likeCount),
    /**
     * 收藏数索引
     */
    index("forum_profile_favorite_count_idx").on(table.favoriteCount),
    /**
     * 创建时间索引
     */
    index("forum_profile_created_at_idx").on(table.createdAt),
]);
