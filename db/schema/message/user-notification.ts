import { boolean, index, integer, jsonb, pgTable, timestamp, unique, varchar } from 'drizzle-orm/pg-core'

/**
 * 用户通知投影表。
 * 只承载通知中心对用户可见的读模型，不再承担 producer 侧通知类型事实源职责。
 */
export const userNotification = pgTable('user_notification', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  categoryKey: varchar({ length: 80 }).notNull(),
  projectionKey: varchar({ length: 180 }).notNull(),
  receiverUserId: integer().notNull(),
  actorUserId: integer(),
  title: varchar({ length: 200 }).notNull(),
  content: varchar({ length: 1000 }).notNull(),
  payload: jsonb(),
  isRead: boolean().default(false).notNull(),
  readAt: timestamp({ withTimezone: true, precision: 6 }),
  expiresAt: timestamp({ withTimezone: true, precision: 6 }),
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, table => [
  unique('user_notification_receiver_user_id_projection_key_key').on(
    table.receiverUserId,
    table.projectionKey,
  ),
  index('user_notification_receiver_user_id_is_read_created_at_idx').on(
    table.receiverUserId,
    table.isRead,
    table.createdAt.desc(),
  ),
  index('user_notification_receiver_user_id_category_key_created_at_idx').on(
    table.receiverUserId,
    table.categoryKey,
    table.createdAt.desc(),
  ),
  index('user_notification_receiver_user_id_created_at_idx').on(
    table.receiverUserId,
    table.createdAt.desc(),
  ),
  index('user_notification_receiver_user_id_expires_at_idx').on(
    table.receiverUserId,
    table.expiresAt,
  ),
])

export type UserNotificationSelect = typeof userNotification.$inferSelect
export type UserNotificationInsert = typeof userNotification.$inferInsert
