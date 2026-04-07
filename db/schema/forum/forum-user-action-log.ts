/**
 * Auto-converted from legacy schema.
 */

import { index, integer, pgTable, smallint, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 论坛用户操作日志表 - 记录用户的所有操作行为，包括创建主题、评论、点赞、收藏等操作
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
   * 操作类型（1=创建主题, 2=创建评论, 3=点赞主题, 4=取消点赞主题, 5=点赞评论, 6=取消点赞评论, 7=收藏主题, 8=取消收藏主题, 9=更新主题, 10=更新评论, 11=删除主题, 12=删除评论）
   */
  actionType: smallint().notNull(),
  /**
   * 目标类型（1=主题, 2=评论）
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
   * 操作发生时解析到的国家/地区
   * 仅记录新写入操作日志的属地快照，无法解析或历史记录时为空
   */
  geoCountry: varchar({ length: 100 }),
  /**
   * 操作发生时解析到的省份/州
   * 仅记录新写入操作日志的属地快照，无法解析或历史记录时为空
   */
  geoProvince: varchar({ length: 100 }),
  /**
   * 操作发生时解析到的城市
   * 仅记录新写入操作日志的属地快照，无法解析或历史记录时为空
   */
  geoCity: varchar({ length: 100 }),
  /**
   * 操作发生时解析到的网络运营商
   * 仅记录新写入操作日志的属地快照，无法解析或历史记录时为空
   */
  geoIsp: varchar({ length: 100 }),
  /**
   * 属地解析来源
   * 当前固定为 ip2region；历史记录或未补齐属地快照时为空
   */
  geoSource: varchar({ length: 50 }),
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

export type ForumUserActionLogSelect = typeof forumUserActionLog.$inferSelect;
export type ForumUserActionLogInsert = typeof forumUserActionLog.$inferInsert;
