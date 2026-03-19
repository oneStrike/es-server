/**
 * Auto-converted from legacy schema.
 */

import { sql } from "drizzle-orm";
import { index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 论坛版主申请表 - 管理用户申请成为版主的申请记录，包括申请信息、审核状态、审核结果等
 */
export const forumModeratorApplication = pgTable("forum_moderator_application", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 申请人用户ID
   */
  applicantId: integer().notNull(),
  /**
   * 申请的板块ID
   */
  sectionId: integer().notNull(),
  /**
   * 审核人ID
   */
  auditById: integer(),
  /**
   * 申请状态（0=待审核, 1=已通过, 2=已拒绝）
   */
  status: smallint().default(0).notNull(),
  /**
   * 申请的权限数组（1=置顶, 2=加精, 3=锁定, 4=删除, 5=审核, 6=移动）
   */
  permissions: integer().array().default(sql`ARRAY[]::integer[]`),
  /**
   * 申请理由
   */
  reason: varchar({ length: 500 }).notNull(),
  /**
   * 审核原因（通过或拒绝的原因）
   */
  auditReason: varchar({ length: 500 }),
  /**
   * 备注
   */
  remark: varchar({ length: 500 }),
  /**
   * 审核时间
   */
  auditAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 软删除时间
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
    /**
     * 申请人与板块唯一约束
     */
    unique("forum_moderator_application_applicant_id_section_id_key").on(table.applicantId, table.sectionId),
    /**
     * 申请人索引
     */
    index("forum_moderator_application_applicant_id_idx").on(table.applicantId),
    /**
     * 板块索引
     */
    index("forum_moderator_application_section_id_idx").on(table.sectionId),
    /**
     * 状态索引
     */
    index("forum_moderator_application_status_idx").on(table.status),
    /**
     * 审核人索引
     */
    index("forum_moderator_application_audit_by_id_idx").on(table.auditById),
    /**
     * 创建时间索引
     */
    index("forum_moderator_application_created_at_idx").on(table.createdAt),
    /**
     * 删除时间索引
     */
    index("forum_moderator_application_deleted_at_idx").on(table.deletedAt),
]);

export type ForumModeratorApplication = typeof forumModeratorApplication.$inferSelect;
export type ForumModeratorApplicationInsert = typeof forumModeratorApplication.$inferInsert;
