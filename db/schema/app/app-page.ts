/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 应用页面表 - 管理应用内的页面配置和路由
 */
export const appPage = snakeCase.table(
  'app_page',
  {
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
     * 访问级别（0=游客, 1=登录, 2=会员, 3=高级会员）
     */
    accessLevel: smallint().default(0).notNull(),
    /**
     * 是否启用
     */
    isEnabled: boolean().default(true).notNull(),
    /**
     * 启用的平台列表（1=H5, 2=App, 3=小程序；默认值为全部平台）
     */
    enablePlatform: smallint()
      .array()
      .default(sql`ARRAY[1,2,3]::smallint[]`),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /**
     * 更新时间
     */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /**
     * 唯一索引: code
     */
    unique('app_page_code_key').on(table.code),
    /**
     * 唯一索引: path
     */
    unique('app_page_path_key').on(table.path),
    /**
     * 访问级别与启用状态索引
     */
    index('app_page_access_level_is_enabled_idx').on(
      table.accessLevel,
      table.isEnabled,
    ),
    /**
     * 访问级别值域约束
     */
    check(
      'app_page_access_level_valid_chk',
      sql`${table.accessLevel} in (0, 1, 2, 3)`,
    ),
    /**
     * 平台数组值域约束
     */
    check(
      'app_page_enable_platform_valid_chk',
      sql`${table.enablePlatform} is null or ${table.enablePlatform} <@ ARRAY[1,2,3]::smallint[]`,
    ),
  ],
)

export type AppPageSelect = typeof appPage.$inferSelect
export type AppPageInsert = typeof appPage.$inferInsert
