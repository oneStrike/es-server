/**
 * Auto-converted from Prisma schema.
 */

import { integer, pgTable, timestamp, unique } from "drizzle-orm/pg-core";
import { work } from "./work";

/**
 * 小说作品扩展表
 */
export const workNovel = pgTable("work_novel", {
  /**
   * 主键id
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 关联的作品ID
   */
  workId: integer("workId").references(() => work.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 总字数
   */
  wordCount: integer("wordCount").default(0).notNull(),
  /**
   * 创建时间
   */
  createdAt: timestamp("createdAt", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
    /**
     * 唯一索引: workId
     */
    unique("work_novel_workId_key").on(table.workId),
]);

