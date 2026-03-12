/**
 * Auto-converted from Prisma schema.
 */

import { boolean, date, index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { userLevelRule } from "./user-level-rule";

/**
 * 应用用户表
 * 存储应用端用户信息及其关联关系
 */
export const appUser = pgTable("app_user", {
  /**
   * 用户ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 账号（唯一）
   */
  account: varchar({ length: 20 }).notNull(),
  /**
   * 手机号（唯一）
   */
  phone: varchar("phone_number", { length: 20 }),
  /**
   * 邮箱（唯一）
   */
  email: varchar("email_address", { length: 255 }),
  /**
   * 等级ID
   */
  levelId: integer().references(() => userLevelRule.id, { onDelete: "set null", onUpdate: "cascade" }),
  /**
   * 昵称
   */
  nickname: varchar({ length: 100 }).notNull(),
  /**
   * 密码（加密存储）
   */
  password: varchar({ length: 500 }).notNull(),
  /**
   * 头像URL
   */
  avatar: varchar("avatar_url", { length: 500 }),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 性别（0=未知，1=男，2=女）
   */
  gender: smallint("gender_type").default(0).notNull(),
  /**
   * 出生日期
   */
  birthDate: date(),
  /**
   * 积分
   */
  points: integer().default(0).notNull(),
  /**
   * 经验值
   */
  experience: integer().default(0).notNull(),
  /**
   * 用户状态
   */
  status: integer().default(1).notNull(),
  /**
   * 封禁原因
   */
  banReason: varchar({ length: 500 }),
  /**
   * 封禁到期时间
   */
  banUntil: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 最后登录时间
   */
  lastLoginAt: timestamp({ withTimezone: true }),
  /**
   * 最后登录IP
   */
  lastLoginIp: varchar({ length: 45 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true }).$onUpdate(() => new Date()).notNull(),
  /**
   * 删除时间（软删除）
   */
  deletedAt: timestamp({ withTimezone: true }),
}, (table) => [
    /**
     * 唯一索引: account
     */
    unique("app_user_account_key").on(table.account),
    /**
     * 唯一索引: phone
     */
    unique("app_user_phone_number_key").on(table.phone),
    /**
     * 唯一索引: email
     */
    unique("app_user_email_address_key").on(table.email),
    /**
     * 启用状态索引
     */
    index("app_user_is_enabled_idx").on(table.isEnabled),
    /**
     * 性别索引
     */
    index("app_user_gender_type_idx").on(table.gender),
    /**
     * 创建时间索引
     */
    index("app_user_created_at_idx").on(table.createdAt),
    /**
     * 最后登录时间索引
     */
    index("app_user_last_login_at_idx").on(table.lastLoginAt),
    /**
     * 手机号索引
     */
    index("app_user_phone_number_idx").on(table.phone),
    /**
     * 邮箱索引
     */
    index("app_user_email_address_idx").on(table.email),
    /**
     * 积分索引
     */
    index("app_user_points_idx").on(table.points),
    /**
     * 状态索引
     */
    index("app_user_status_idx").on(table.status),
    /**
     * 等级索引
     */
    index("app_user_level_id_idx").on(table.levelId),
]);

