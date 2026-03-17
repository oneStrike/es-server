/**
 * Auto-converted from legacy schema.
 */

import { index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 论坛配置历史表 - 记录配置项的变更历史，支持版本控制和回滚功能
 */
export const forumConfigHistory = pgTable("forum_config_history", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 配置ID
   */
  configId: integer().notNull(),
  /**
   * 操作人ID
   */
  operatedById: integer(),
  /**
   * 变更的配置项（JSON格式，存储字段名和变更详情）
   * 示例：{"siteName": {"old": "旧站点名", "new": "新站点名"}, "topicTitleMaxLength": {"old": 200, "new": 300}}
   */
  changes: jsonb().notNull(),
  /**
   * 变更类型（create, update, restore）
   */
  changeType: varchar({ length: 20 }).notNull(),
  /**
   * 变更原因
   */
  reason: varchar({ length: 500 }),
  /**
   * IP地址
   */
  ipAddress: varchar({ length: 50 }),
  /**
   * 用户代理
   */
  userAgent: varchar({ length: 500 }),
  /**
   * 操作时间
   */
  operatedAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
    /**
     * 配置索引
     */
    index("forum_config_history_config_id_idx").on(table.configId),
    /**
     * 变更类型索引
     */
    index("forum_config_history_change_type_idx").on(table.changeType),
    /**
     * 操作人索引
     */
    index("forum_config_history_operated_by_id_idx").on(table.operatedById),
    /**
     * 操作时间索引
     */
    index("forum_config_history_operated_at_idx").on(table.operatedAt),
]);
