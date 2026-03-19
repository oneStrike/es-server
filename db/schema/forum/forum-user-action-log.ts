/**
 * Auto-converted from legacy schema.
 */

import { index, integer, pgTable, smallint, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 论坛用户操作日志表 - 记录用户的所有操作行为，包括创建主题、回复、点赞、收藏等操作
 */
export const forumUserActionLog = pgTable("forum_user_action_log", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 关联的用户ID
   */
  userId: integer().notNull(),
  /**
   * 目标ID
   */
  targetId: integer().notNull(),
  /**
   * 操作类型（1=创建主题, 2=创建回复, 3=点赞主题, 4=取消点赞主题, 5=点赞回复, 6=取消点赞回复, 7=收藏主题, 8=取消收藏主题, 9=更新主题, 10=更新回复, 11=删除主题, 12=删除回复）
   */
  actionType: smallint().notNull(),
  /**
   * 目标类型（1=主题, 2=回复）
   */
  targetType: smallint().notNull(),
  /**
   * 操作前数据（JSON格式）
   */
  beforeData: text(),
  /**
   * 操作后数据（JSON格式）
   */
  afterData: text(),
  /**
   * IP地址
   */
  ipAddress: varchar({ length: 45 }),
  /**
   * User Agent
   */
  userAgent: varchar({ length: 500 }),
  /**
   * 操作时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
    /**
     * 用户索引
     */
    index("forum_user_action_log_user_id_idx").on(table.userId),
    /**
     * 操作类型索引
     */
    index("forum_user_action_log_action_type_idx").on(table.actionType),
    /**
     * 目标类型与目标ID索引
     */
    index("forum_user_action_log_target_type_target_id_idx").on(table.targetType, table.targetId),
    /**
     * IP 地址索引
     */
    index("forum_user_action_log_ip_address_idx").on(table.ipAddress),
    /**
     * 创建时间索引
     */
    index("forum_user_action_log_created_at_idx").on(table.createdAt),
    /**
     * 用户与创建时间索引
     */
    index("forum_user_action_log_user_id_created_at_idx").on(table.userId, table.createdAt),
]);

export type ForumUserActionLog = typeof forumUserActionLog.$inferSelect;
export type ForumUserActionLogInsert = typeof forumUserActionLog.$inferInsert;
