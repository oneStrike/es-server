/**
 * Auto-converted from legacy schema.
 */

import { index, integer, pgTable, primaryKey } from "drizzle-orm/pg-core";

/**
 * 作品分类关联表
 */
export const workCategoryRelation = pgTable("work_category_relation", {
  /**
   * 作品ID
   */
  workId: integer().notNull(),
  /**
   * 分类ID
   */
  categoryId: integer().notNull(),
  /**
   * 排序顺序（用于展示顺序）
   */
  sortOrder: integer().default(0).notNull(),
}, (table) => [
    /**
     * 分类索引
     */
    index("work_category_relation_category_id_idx").on(table.categoryId),
    /**
     * 作品与排序索引
     */
    index("work_category_relation_work_id_sort_order_idx").on(table.workId, table.sortOrder),
    /**
     * 作品与分类复合主键
     */
    primaryKey({ columns: [table.workId, table.categoryId] }),
]);
