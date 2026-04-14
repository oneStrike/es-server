/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 应用用户令牌表 - 用于存储用户的 JWT Token，支持多设备登录管理和 Token 撤销
 */
export const appUserToken = pgTable("app_user_token", {
  /**
   * 令牌ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * JWT Token ID（唯一标识，用于黑名单和撤销）
   */
  jti: varchar({ length: 255 }).notNull(),
  /**
   * 用户ID
   */
  userId: integer().notNull(),
  /**
   * 令牌类型（1=访问令牌，2=刷新令牌）
   */
  tokenType: smallint().notNull(),
  /**
   * 令牌过期时间
   */
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  /**
   * 令牌撤销时间（null表示未撤销）
   */
  revokedAt: timestamp({ withTimezone: true }),
  /**
   * 撤销原因（1=密码修改后强制下线，2=刷新令牌轮换，3=用户主动退出登录，4=管理员强制下线，5=安全风控撤销，6=令牌自然过期）
   */
  revokeReason: smallint(),
  /**
   * 设备信息（JSON格式，包含设备类型、操作系统、浏览器等）
   */
  deviceInfo: jsonb(),
  /**
   * IP地址
   */
  ipAddress: varchar({ length: 45 }),
  /**
   * 用户代理
   */
  userAgent: varchar({ length: 500 }),
  /**
   * 登录态创建时解析到的国家/地区
   * 仅记录新写入 token 的属地快照，无法解析或历史记录时为空
   */
  geoCountry: varchar({ length: 100 }),
  /**
   * 登录态创建时解析到的省份/州
   * 仅记录新写入 token 的属地快照，无法解析或历史记录时为空
   */
  geoProvince: varchar({ length: 100 }),
  /**
   * 登录态创建时解析到的城市
   * 仅记录新写入 token 的属地快照，无法解析或历史记录时为空
   */
  geoCity: varchar({ length: 100 }),
  /**
   * 登录态创建时解析到的网络运营商
   * 仅记录新写入 token 的属地快照，无法解析或历史记录时为空
   */
  geoIsp: varchar({ length: 100 }),
  /**
   * 属地解析来源
   * 当前固定为 ip2region；历史记录或未补齐属地快照时为空
   */
  geoSource: varchar({ length: 50 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  /**
   * 唯一索引: jti
   */
  unique("app_user_token_jti_key").on(table.jti),
  /**
   * 单列索引
   * 用户索引
   */
  index("app_user_token_user_id_idx").on(table.userId),
  /**
   * JTI 索引（黑名单检查）
   */
  index("app_user_token_jti_idx").on(table.jti),
  /**
   * 类型索引
   */
  index("app_user_token_token_type_idx").on(table.tokenType),
  /**
   * 过期时间索引
   */
  index("app_user_token_expires_at_idx").on(table.expiresAt),
  /**
   * 撤销时间索引
   */
  index("app_user_token_revoked_at_idx").on(table.revokedAt),
  /**
   * 组合索引
   * 用户与类型索引
   */
  index("app_user_token_user_id_token_type_idx").on(table.userId, table.tokenType),
  check("app_user_token_token_type_valid_chk", sql`${table.tokenType} in (1, 2)`),
  check(
    "app_user_token_revoke_reason_valid_chk",
    sql`${table.revokeReason} is null or ${table.revokeReason} in (1, 2, 3, 4, 5, 6)`,
  ),
]);

/**
 * 应用用户令牌推导类型
 */
export type AppUserTokenSelect = typeof appUserToken.$inferSelect;
export type AppUserTokenInsert = typeof appUserToken.$inferInsert;
