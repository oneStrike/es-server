/**
 * Auto-converted from legacy schema.
 */

import { index, integer, pgTable, smallint, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * 用户收藏记录表
 * 记录用户对各类目标（漫画、小说、论坛主题）的收藏操作
 * 支持收藏计数统计和用户收藏列表查询
 */
export const userFavorite = pgTable("user_favorite", {
  /**
   * 主键ID（自增）
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 目标类型 1=漫画, 2=小说, 3=论坛主题
   */
  targetType: smallint().notNull(),
  /**
   * 目标ID
   */
  targetId: integer().notNull(),
  /**
   * 用户ID（关联 app_user.id）
   */
  userId: integer().notNull(),
  /**
   * 创建时间（收藏时间）
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
    /**
     * 唯一约束：同一用户对同一目标只能收藏一次
     */
    unique("user_favorite_target_type_target_id_user_id_key").on(table.targetType, table.targetId, table.userId),
    /**
     * 目标类型与目标ID联合索引
     */
    index("user_favorite_target_type_target_id_idx").on(table.targetType, table.targetId),
    /**
     * 用户ID索引
     */
    index("user_favorite_user_id_idx").on(table.userId),
    /**
     * 创建时间索引
     */
    index("user_favorite_created_at_idx").on(table.createdAt),
]);

export type UserFavoriteSelect = typeof userFavorite.$inferSelect;
export type UserFavoriteInsert = typeof userFavorite.$inferInsert;
