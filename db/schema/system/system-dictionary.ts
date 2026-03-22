/**
 * Auto-converted from legacy schema.
 */

import { boolean, index, integer, pgTable, smallserial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 数据字典
 */
export const dictionary = pgTable("sys_dictionary", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 字典名称
   */
  name: varchar({ length: 50 }).notNull(),
  /**
   * 字典编码
   */
  code: varchar({ length: 50 }).notNull(),
  /**
   * 字典封面图片URL
   */
  cover: varchar({ length: 200 }),
  /**
   * 字典状态：true=启用，false=禁用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 字典描述信息
   */
  description: varchar({ length: 255 }),
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
     * 唯一索引: name
     */
    unique("sys_dictionary_name_key").on(table.name),
    /**
     * 唯一索引: code
     */
    unique("sys_dictionary_code_key").on(table.code),
]);

/**
 * 数据字典项
 */
export const dictionaryItem = pgTable("sys_dictionary_item", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 所属字典编码
   */
  dictionaryCode: text().notNull(),
  /**
   * 字典项名称
   */
  name: varchar({ length: 50 }).notNull(),
  /**
   * 字典项编码
   */
  code: varchar({ length: 50 }).notNull(),
  /**
   * 显示排序（数值越小越靠前）
   */
  sortOrder: smallserial(),
  /**
   * 字典项图标URL
   */
  cover: varchar({ length: 200 }),
  /**
   * 字典项状态：true=启用，false=禁用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 字典项描述信息
   */
  description: varchar({ length: 255 }),
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
     * 字典编码与项编码唯一约束
     */
    unique("sys_dictionary_item_dictionary_code_code_key").on(table.dictionaryCode, table.code),
    /**
     * 字典编码索引
     */
    index("sys_dictionary_item_dictionary_code_idx").on(table.dictionaryCode),
    /**
     * 排序索引
     */
    index("sys_dictionary_item_sort_order_idx").on(table.sortOrder),
]);

export type Dictionary = typeof dictionary.$inferSelect;
export type DictionaryInsert = typeof dictionary.$inferInsert;
export type DictionaryItem = typeof dictionaryItem.$inferSelect;
export type DictionaryItemInsert = typeof dictionaryItem.$inferInsert;
