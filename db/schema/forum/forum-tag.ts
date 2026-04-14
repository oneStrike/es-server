/**
 * Auto-converted from legacy schema.
 */

import { boolean, index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 论坛标签表 - 管理论坛标签信息，包括标签名称、图标、使用次数等
 */
export const forumTag = pgTable("forum_tag", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 标签名称
   */
  name: varchar({ length: 20 }).notNull(),
  /**
   * 标签图标URL
   */
  icon: varchar({ length: 255 }),
  /**
   * 标签描述
   */
  description: varchar({ length: 200 }),
  /**
   * 排序值（0=默认排序，数值越小越靠前）
   */
  sortOrder: smallint().default(0).notNull(),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 使用次数
   */
  useCount: integer().default(0).notNull(),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  /**
   * 唯一索引: name
   */
  unique("forum_tag_name_key").on(table.name),
  /**
   * 排序索引
   */
  index("forum_tag_sort_order_idx").on(table.sortOrder),
  /**
   * 名称索引
   */
  index("forum_tag_name_idx").on(table.name),
  /**
   * 启用状态索引
   */
  index("forum_tag_is_enabled_idx").on(table.isEnabled),
  /**
   * 使用次数索引
   */
  index("forum_tag_use_count_idx").on(table.useCount),
  /**
   * 创建时间索引
   */
  index("forum_tag_created_at_idx").on(table.createdAt),
]);

export type ForumTagSelect = typeof forumTag.$inferSelect;
export type ForumTagInsert = typeof forumTag.$inferInsert;
