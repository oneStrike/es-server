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
 * 作品分类模型
 */
export const workCategory = snakeCase.table(
  'work_category',
  {
    /**
     * 主键ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 分类名称（唯一）
     */
    name: varchar({ length: 20 }).notNull(),
    /**
     * 分类描述
     */
    description: varchar({ length: 200 }),
    /**
     * 分类图标URL
     */
    icon: varchar({ length: 255 }),
    /**
     * 关联内容类型（1=漫画，2=小说，3=帖子）
     */
    contentType: smallint().array(),
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
    unique('work_category_name_key').on(table.name),
    /**
     * 排序索引
     */
    index('work_category_sort_order_idx').on(table.sortOrder),
    /**
     * 名称索引
     */
    index('work_category_name_idx').on(table.name),
    /**
     * 内容类型索引
     */
    index('work_category_content_type_idx').using('gin', table.contentType),
    /**
     * 内容类型闭合值域约束
     */
    check(
      'work_category_content_type_valid_chk',
      sql`${table.contentType} is null or ${table.contentType} <@ '{1,2,3}'::smallint[]`,
    ),
  ],
)

export type WorkCategorySelect = typeof workCategory.$inferSelect
export type WorkCategoryInsert = typeof workCategory.$inferInsert
