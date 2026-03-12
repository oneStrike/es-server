/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 请求日志
 */
export const requestLog = pgTable("sys_request_log", {
  /**
   * 主键id
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 用户ID（可空）
   */
  userId: integer(),
  /**
   * 用户名（可空）
   */
  username: text(),
  /**
   * 接口类型（admin/app/system等，可空）
   */
  apiType: varchar({ length: 20 }),
  /**
   * 请求方法（GET/POST等）
   */
  method: varchar({ length: 10 }).notNull(),
  /**
   * 请求路径
   */
  path: varchar({ length: 255 }).notNull(),
  /**
   * 请求参数（JSON格式）
   */
  params: jsonb(),
  /**
   * IP地址（自动获取）
   */
  ip: varchar({ length: 45 }),
  /**
   * 设备信息（User-Agent 原始字符串）
   */
  userAgent: varchar({ length: 255 }),
  /**
   * 设备信息（User-Agent 解析结果，JSON）
   */
  device: jsonb(),
  /**
   * 操作类型（如登录/注册）
   */
  actionType: varchar({ length: 50 }),
  /**
   * 操作结果
   */
  isSuccess: boolean().notNull(),
  /**
   * 自定义日志内容（必填）
   */
  content: text().notNull(),
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
     * 创建时间索引
     */
    index("sys_request_log_created_at_idx").on(table.createdAt),
    /**
     * 用户ID索引
     */
    index("sys_request_log_user_id_idx").on(table.userId),
    /**
     * 用户名索引
     */
    index("sys_request_log_username_idx").on(table.username),
    /**
     * 请求结果索引
     */
    index("sys_request_log_is_success_idx").on(table.isSuccess),
]);
