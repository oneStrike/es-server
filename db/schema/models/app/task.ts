/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, jsonb, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { adminUser } from "../admin/admin-user";

/**
 * 任务定义
 */
export const task = pgTable("task", {
  /**
   * 主键id
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 任务编码
   */
  code: varchar({ length: 50 }).notNull(),
  /**
   * 任务标题
   */
  title: varchar({ length: 200 }).notNull(),
  /**
   * 任务描述
   */
  description: varchar({ length: 1000 }),
  /**
   * 任务封面
   */
  cover: varchar({ length: 255 }),
  /**
   * 任务类型
   */
  type: smallint().notNull(),
  /**
   * 任务状态
   */
  status: smallint().notNull(),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 任务优先级
   */
  priority: smallint().default(0).notNull(),
  /**
   * 领取方式
   */
  claimMode: smallint().notNull(),
  /**
   * 完成方式
   */
  completeMode: smallint().notNull(),
  /**
   * 目标次数
   */
  targetCount: integer().default(1).notNull(),
  /**
   * 奖励配置
   */
  rewardConfig: jsonb(),
  /**
   * 重复规则
   */
  repeatRule: jsonb(),
  /**
   * 发布开始时间
   */
  publishStartAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 发布结束时间
   */
  publishEndAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 创建人ID
   */
  createdById: integer().references(() => adminUser.id, { onDelete: "set null", onUpdate: "cascade" }),
  /**
   * 更新人ID
   */
  updatedById: integer().references(() => adminUser.id, { onDelete: "set null", onUpdate: "cascade" }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 删除时间
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
    /**
     * 唯一索引: code
     */
    unique("task_code_key").on(table.code),
    /**
     * 状态与启用索引
     */
    index("task_status_is_enabled_idx").on(table.status, table.isEnabled),
    /**
     * 任务类型索引
     */
    index("task_type_idx").on(table.type),
    /**
     * 发布开始时间索引
     */
    index("task_publish_start_at_idx").on(table.publishStartAt),
    /**
     * 发布结束时间索引
     */
    index("task_publish_end_at_idx").on(table.publishEndAt),
    /**
     * 创建时间索引
     */
    index("task_created_at_idx").on(table.createdAt),
    /**
     * 删除时间索引
     */
    index("task_deleted_at_idx").on(table.deletedAt),
]);

