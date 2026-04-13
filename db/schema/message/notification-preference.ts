import { boolean, index, integer, pgTable, timestamp, unique, varchar } from 'drizzle-orm/pg-core'

/**
 * 通知偏好表。
 * 只按用户与通知分类维度保存显式覆盖值。
 */
export const notificationPreference = pgTable('notification_preference', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull(),
  categoryKey: varchar({ length: 80 }).notNull(),
  isEnabled: boolean().notNull(),
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, table => [
  unique('notification_preference_user_id_category_key_key').on(
    table.userId,
    table.categoryKey,
  ),
  index('notification_preference_user_id_idx').on(table.userId),
  index('notification_preference_user_id_is_enabled_idx').on(
    table.userId,
    table.isEnabled,
  ),
])

export type NotificationPreferenceSelect = typeof notificationPreference.$inferSelect
export type NotificationPreferenceInsert = typeof notificationPreference.$inferInsert
