/**
 * Auto-converted from Prisma schema.
 */

import { index, integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { workCategory } from "./work-category";
import { work } from "./work";

/**
 * 作品分类关联表
 */
export const workCategoryRelation = pgTable("work_category_relation", {
  /**
   * 作品ID
   */
  workId: integer().references(() => work.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 分类ID
   */
  categoryId: integer().references(() => workCategory.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 排序顺序（用于展示顺序）
   */
  sortOrder: integer().default(0).notNull(),
  /**
   * 关联时间
   */
  createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ precision: 3 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
    /**
     * 分类索引
     */
    index("work_category_relation_category_id_idx").on(table.categoryId),
    /**
     * 排序索引
     */
    index("work_category_relation_sort_order_idx").on(table.sortOrder),
    /**
     * 作品与排序索引
     */
    index("work_category_relation_work_id_sort_order_idx").on(table.workId, table.sortOrder),
    /**
     * 作品与分类复合主键
     */
    primaryKey({ columns: [table.workId, table.categoryId] }),
]);

