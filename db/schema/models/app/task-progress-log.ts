/**
 * Auto-converted from Prisma schema.
 */

import { index, integer, jsonb, pgTable, smallint, timestamp } from "drizzle-orm/pg-core";
import { appUser } from "./app-user";
import { taskAssignment } from "./task-assignment";

/**
 * 任务进度日志
 */
export const taskProgressLog = pgTable("task_progress_log", {
  /**
   * 主键id
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 分配记录ID
   */
  assignmentId: integer().references(() => taskAssignment.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 用户ID
   */
  userId: integer().references(() => appUser.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 操作类型
   */
  actionType: smallint().notNull(),
  /**
   * 变更值
   */
  delta: integer().notNull(),
  /**
   * 变更前值
   */
  beforeValue: integer().notNull(),
  /**
   * 变更后值
   */
  afterValue: integer().notNull(),
  /**
   * 变更上下文
   */
  context: jsonb(),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
    /**
     * 分配记录索引
     */
    index("task_progress_log_assignment_id_idx").on(table.assignmentId),
    /**
     * 用户与创建时间索引
     */
    index("task_progress_log_user_id_created_at_idx").on(table.userId, table.createdAt),
]);

