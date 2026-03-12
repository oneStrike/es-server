/**
 * Auto-converted from Prisma schema.
 */

import { index, integer, pgTable, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * 作品作者关联表（多对多关系中间表）
 */
export const workAuthorRelation = pgTable("work_author_relation", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
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
     * 作品与作者唯一约束
     */
    unique("work_author_relation_work_id_author_id_key").on(table.workId, table.authorId),
    /**
     * 作品索引
     */
    index("work_author_relation_work_id_idx").on(table.workId),
    /**
     * 作者索引
     */
    index("work_author_relation_author_id_idx").on(table.authorId),
]);
