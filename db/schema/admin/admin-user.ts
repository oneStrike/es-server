/**
 * Auto-converted from legacy schema.
 */

import { boolean, index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 管理端用户
 */
export const adminUser = pgTable("admin_user", {
  /**
   * 主键id
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 账号
   */
  username: varchar({ length: 20 }).notNull(),
  /**
   * 密码
   */
  password: varchar({ length: 500 }).notNull(),
  /**
   * 手机号码；为空表示未绑定，非空时在管理端账号内必须唯一
   */
  mobile: varchar({ length: 11 }),
  /**
   * 头像
   */
  avatar: varchar({ length: 200 }),
  /**
   * 账号角色
   */
  role: smallint().default(0).notNull(),
  /**
   * 是否启用账号
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 最后登录时间
   */
  lastLoginAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 最后登录IP
   */
  lastLoginIp: varchar({ length: 45 }),
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
     * 唯一索引: username
     */
    unique("admin_user_username_key").on(table.username),
    /**
     * 唯一索引: mobile（仅约束非空值）
     */
    unique("admin_user_mobile_key").on(table.mobile),
    /**
     * 启用状态索引
     */
    index("admin_user_is_enabled_idx").on(table.isEnabled),
    /**
     * 角色索引
     */
    index("admin_user_role_idx").on(table.role),
    /**
     * 创建时间索引
     */
    index("admin_user_created_at_idx").on(table.createdAt),
    /**
     * 最近登录时间索引
     */
    index("admin_user_last_login_at_idx").on(table.lastLoginAt),
]);

/**
 * 管理端用户推导类型
 */
export type AdminUserSelect = typeof adminUser.$inferSelect;
export type AdminUserInsert = typeof adminUser.$inferInsert;
