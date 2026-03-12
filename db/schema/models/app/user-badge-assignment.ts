/**
 * Auto-converted from Prisma schema.
 */

import { index, integer, pgTable, timestamp, unique } from "drizzle-orm/pg-core";
import { appUser } from "./app-user";
import { userBadge } from "./user-badge";

/**
 * 用户徽章关联表 - 管理用户获得的徽章
 */
export const userBadgeAssignment = pgTable("user_badge_assignment", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 关联的用户ID
   */
  userId: integer().references(() => appUser.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 关联的徽章ID
   */
  badgeId: integer().references(() => userBadge.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 获得时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
    /**
     * 用户与徽章唯一约束
     */
    unique("user_badge_assignment_user_id_badge_id_key").on(table.userId, table.badgeId),
    /**
     * 用户索引
     */
    index("user_badge_assignment_user_id_idx").on(table.userId),
    /**
     * 徽章索引
     */
    index("user_badge_assignment_badge_id_idx").on(table.badgeId),
    /**
     * 创建时间索引
     */
    index("user_badge_assignment_created_at_idx").on(table.createdAt),
]);

