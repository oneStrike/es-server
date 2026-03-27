/**
 * Auto-converted from legacy schema.
 */

import { index, integer, pgTable, primaryKey } from "drizzle-orm/pg-core";

/**
 * 作品标签关联表
 */
export const workTagRelation = pgTable("work_tag_relation", {
  /**
   * 作品ID
   */
  workId: integer().notNull(),
  /**
   * 标签ID
   */
  tagId: integer().notNull(),
}, (table) => [
    /**
     * 标签索引
     */
    index("work_tag_relation_tag_id_idx").on(table.tagId),
    /**
     * 作品与标签复合主键
     */
    primaryKey({ columns: [table.workId, table.tagId] }),
]);
