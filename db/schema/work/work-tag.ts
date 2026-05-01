/**
 * Auto-converted from legacy schema.
 */

import {
  boolean,
  index,
  integer,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 标签模型
 */
export const workTag = snakeCase.table(
  'work_tag',
  {
    /**
     * 主键ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 标签名称（唯一）
     */
    name: varchar({ length: 20 }).notNull(),
    /**
     * 标签图标URL
     */
    icon: varchar({ length: 255 }),
    /**
     * 标签描述
     */
    description: varchar({ length: 200 }),
    /**
     * 排序值（0=默认排序，数值越小越靠前）
     */
    sortOrder: smallint().default(0).notNull(),
    /**
     * 是否启用
     */
    isEnabled: boolean().default(true).notNull(),
    /**
     * 人气值（用于展示和排序）
     */
    popularity: integer().default(0).notNull(),
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
     * 唯一索引: name
     */
    unique('work_tag_name_key').on(table.name),
    /**
     * 排序索引
     */
    index('work_tag_sort_order_idx').on(table.sortOrder),
    /**
     * 名称索引
     */
    index('work_tag_name_idx').on(table.name),
    /**
     * 启用状态索引
     */
    index('work_tag_is_enabled_idx').on(table.isEnabled),
  ],
)

export type WorkTagSelect = typeof workTag.$inferSelect
export type WorkTagInsert = typeof workTag.$inferInsert
