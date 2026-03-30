/**
 * Auto-converted from legacy schema.
 */

import { boolean, index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 作品分类模型
 */
export const workCategory = pgTable("work_category", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 分类名称（唯一）
   */
  name: varchar({ length: 20 }).notNull(),
  /**
   * 分类描述
   */
  description: varchar({ length: 200 }),
  /**
   * 分类图标URL
   */
  icon: varchar({ length: 255 }),
  /**
   * 关联内容类型（如：1漫画、2小说、4插画、8写真）
   */
  contentType: smallint().array(),
  /**
   * 排序值（数值越小越靠前）
   */
  sortOrder: smallint().default(0).notNull(),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 人气值（用于展示和排序）
   */
  popularity: integer().default(0).notNull(),
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
    unique("work_category_name_key").on(table.name),
    /**
     * 排序索引
     */
    index("work_category_sort_order_idx").on(table.sortOrder),
    /**
     * 名称索引
     */
    index("work_category_name_idx").on(table.name),
    /**
     * 内容类型索引
     */
    index("work_category_content_type_idx").using("gin", table.contentType),
]);

export type WorkCategorySelect = typeof workCategory.$inferSelect;
export type WorkCategoryInsert = typeof workCategory.$inferInsert;
