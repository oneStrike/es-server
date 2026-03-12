/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 应用页面表 - 管理应用内的页面配置和路由
 */
export const appPage = pgTable("app_page", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 页面代码（唯一标识）
   */
  code: varchar({ length: 50 }).notNull(),
  /**
   * 页面路径（唯一）
   */
  path: varchar({ length: 300 }).notNull(),
  /**
   * 页面名称
   */
  name: varchar({ length: 100 }).notNull(),
  /**
   * 页面标题
   */
  title: varchar({ length: 200 }).notNull(),
  /**
   * 页面描述
   */
  description: varchar({ length: 500 }),
  /**
   * 访问级别（0=公开, 1=登录用户, 2=会员, 9=管理员）
   */
  accessLevel: smallint().default(0).notNull(),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 启用的平台列表
   */
  enablePlatform: integer().array(),
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
     * 唯一索引: code
     */
    unique("app_page_code_key").on(table.code),
    /**
     * 唯一索引: path
     */
    unique("app_page_path_key").on(table.path),
    /**
     * 访问级别与启用状态索引
     */
    index("app_page_access_level_is_enabled_idx").on(table.accessLevel, table.isEnabled),
]);
