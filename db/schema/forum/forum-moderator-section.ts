/**
 * Auto-converted from legacy schema.
 */

import { sql } from "drizzle-orm";
import { index, integer, pgTable, primaryKey } from "drizzle-orm/pg-core";

/**
 * 论坛版主板块关联表 - 管理板块版主与板块的多对多关系，一个板块版主可以管理多个板块
 */
export const forumModeratorSection = pgTable("forum_moderator_section", {
  /**
   * 关联的版主ID
   */
  moderatorId: integer().notNull(),
  /**
   * 关联的板块ID
   */
  sectionId: integer().notNull(),
  /**
   * 自定义权限数组（与版主基础权限做合并）
   */
  permissions: integer().array().default(sql`ARRAY[]::integer[]`),
}, (table) => [
    /**
     * 板块索引
     */
    index("forum_moderator_section_section_id_idx").on(table.sectionId),
    /**
     * 版主与板块复合主键
     */
    primaryKey({ columns: [table.moderatorId, table.sectionId] }),
]);

export type ForumModeratorSection = typeof forumModeratorSection.$inferSelect;
export type ForumModeratorSectionInsert = typeof forumModeratorSection.$inferInsert;
