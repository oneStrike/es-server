/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, pgTable, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 论坛板块分组表 - 管理论坛板块分组信息，用于对板块进行分类组织
 */
export const forumSectionGroup = pgTable("forum_section_group", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 分组名称
   */
  name: varchar({ length: 50 }).notNull(),
  /**
   * 分组描述
   */
  description: varchar({ length: 500 }),
  /**
   * 排序值（数值越小越靠前）
   */
  sortOrder: integer().default(0).notNull(),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 分组版主数量限制（0表示不限制）
   */
  maxModerators: integer().default(0).notNull(),
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
     * 唯一索引: name
     */
    unique("forum_section_group_name_key").on(table.name),
    /**
     * 排序索引
     */
    index("forum_section_group_sort_order_idx").on(table.sortOrder),
    /**
     * 启用状态索引
     */
    index("forum_section_group_is_enabled_idx").on(table.isEnabled),
    /**
     * 创建时间索引
     */
    index("forum_section_group_created_at_idx").on(table.createdAt),
    /**
     * 删除时间索引
     */
    index("forum_section_group_deleted_at_idx").on(table.deletedAt),
]);
