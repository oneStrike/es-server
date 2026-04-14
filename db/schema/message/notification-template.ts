import { boolean, index, integer, pgTable, timestamp, unique, varchar } from 'drizzle-orm/pg-core'

/**
 * 通知模板表。
 * 以 categoryKey 为唯一稳定配置键。
 */
export const notificationTemplate = pgTable('notification_template', {
  /** 主键 ID。 */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** 通知分类键。 */
  categoryKey: varchar({ length: 80 }).notNull(),
  /** 标题模板。 */
  titleTemplate: varchar({ length: 200 }).notNull(),
  /** 正文模板。 */
  contentTemplate: varchar({ length: 1000 }).notNull(),
  /** 是否启用。 */
  isEnabled: boolean().default(true).notNull(),
  /** 备注。 */
  remark: varchar({ length: 500 }),
  /** 创建时间。 */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /** 更新时间。 */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, table => [
  unique('notification_template_category_key_key').on(table.categoryKey),
  index('notification_template_category_key_idx').on(table.categoryKey),
  index('notification_template_is_enabled_idx').on(table.isEnabled),
  index('notification_template_updated_at_idx').on(table.updatedAt),
])

export type NotificationTemplateSelect = typeof notificationTemplate.$inferSelect
export type NotificationTemplateInsert = typeof notificationTemplate.$inferInsert
