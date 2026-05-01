/**
 * Auto-converted from legacy schema.
 */

import { index, integer, primaryKey, snakeCase } from 'drizzle-orm/pg-core'

/**
 * 作品作者关联表（多对多关系中间表）
 */
export const workAuthorRelation = snakeCase.table(
  'work_author_relation',
  {
    /**
     * 作品ID
     */
    workId: integer().notNull(),
    /**
     * 作者ID
     */
    authorId: integer().notNull(),
    /**
     * 排序顺序（用于展示顺序）
     */
    sortOrder: integer().default(0).notNull(),
  },
  (table) => [
    /**
     * 作者索引
     */
    index('work_author_relation_author_id_idx').on(table.authorId),
    /**
     * 作品与排序索引
     */
    index('work_author_relation_work_id_sort_order_idx').on(
      table.workId,
      table.sortOrder,
    ),
    /**
     * 作品与作者复合主键
     */
    primaryKey({ columns: [table.workId, table.authorId] }),
  ],
)
