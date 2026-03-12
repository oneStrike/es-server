/**
 * Auto-converted from Prisma schema.
 */

import { index, integer, pgTable, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { forumModerator } from "./forum-moderator";
import { forumSection } from "./forum-section";

/**
 * 论坛版主板块关联表 - 管理板块版主与板块的多对多关系，一个板块版主可以管理多个板块
 */
export const forumModeratorSection = pgTable("forum_moderator_section", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 关联的版主ID
   */
  moderatorId: integer().references(() => forumModerator.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 关联的板块ID
   */
  sectionId: integer().references(() => forumSection.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 自定义权限数组（与版主基础权限做合并）
   */
  permissions: integer().array().default(sql`ARRAY[]::integer[]`),
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
     * 版主与板块唯一约束
     */
    unique("forum_moderator_section_moderator_id_section_id_key").on(table.moderatorId, table.sectionId),
    /**
     * 版主索引
     */
    index("forum_moderator_section_moderator_id_idx").on(table.moderatorId),
    /**
     * 板块索引
     */
    index("forum_moderator_section_section_id_idx").on(table.sectionId),
    /**
     * 创建时间索引
     */
    index("forum_moderator_section_created_at_idx").on(table.createdAt),
]);

