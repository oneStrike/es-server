/**
 * Auto-converted from legacy schema.
 */

import { index, integer, primaryKey, snakeCase } from 'drizzle-orm/pg-core'

/**
 * 作品标签关联表
 */
export const workTagRelation = snakeCase.table(
  'work_tag_relation',
  {
    /**
     * 作品ID
     */
    workId: integer().notNull(),
    /**
     * 标签ID
     */
    tagId: integer().notNull(),
    /**
     * 排序顺序（用于展示顺序）
     */
    sortOrder: integer().default(0).notNull(),
  },
  (table) => [
    /**
     * 标签索引
     */
    index('work_tag_relation_tag_id_idx').on(table.tagId),
    /**
     * 作品与排序索引
     */
    index('work_tag_relation_work_id_sort_order_idx').on(
      table.workId,
      table.sortOrder,
      table.tagId,
    ),
    /**
     * 作品与标签复合主键
     */
    primaryKey({ columns: [table.workId, table.tagId] }),
  ],
)
