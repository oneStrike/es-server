/**
 * Auto-converted from legacy schema.
 */

import { boolean, index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 应用配置表 - 存储应用的基础配置信息
 */
export const appConfig = pgTable("app_config", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 应用名称
   */
  appName: varchar({ length: 100 }).notNull(),
  /**
   * 应用描述
   */
  appDesc: varchar({ length: 500 }),
  /**
   * 应用Logo URL
   */
  appLogo: varchar({ length: 500 }),
  /**
   * 引导页图片 URL
   */
  onboardingImage: varchar({ length: 1000 }),
  /**
   * 主题色
   */
  themeColor: varchar({ length: 20 }).default("#007AFF").notNull(),
  /**
   * 第二主题色
   */
  secondaryColor: varchar({ length: 20 }),
  /**
   * 可选的主题色
   */
  optionalThemeColors: varchar({ length: 500 }),
  /**
   * 是否启用维护模式
   */
  enableMaintenanceMode: boolean().default(false).notNull(),
  /**
   * 维护模式提示信息
   */
  maintenanceMessage: varchar({ length: 500 }),
  /**
   * 配置版本号
   */
  version: varchar({ length: 50 }).default("1.0.0").notNull(),
  /**
   * 最后修改人ID
   */
  updatedById: integer(),
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
     * 按最后修改人查询配置
     */
    index("app_config_updated_by_id_idx").on(table.updatedById),
]);

export type AppConfigSelect = typeof appConfig.$inferSelect;
export type AppConfigInsert = typeof appConfig.$inferInsert;
