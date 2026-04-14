import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 通知 consumer 处理结果表。
 * 记录 notification consumer 对单条 dispatch 的最终业务处理结果。
 */
export const notificationDelivery = pgTable(
  'notification_delivery',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    eventId: bigint({ mode: 'bigint' }).notNull(),
    dispatchId: bigint({ mode: 'bigint' }).notNull(),
    eventKey: varchar({ length: 120 }).notNull(),
    receiverUserId: integer(),
    projectionKey: varchar({ length: 180 }),
    categoryKey: varchar({ length: 80 }),
    notificationId: integer(),
    status: varchar({ length: 32 }).notNull(),
    templateId: integer(),
    usedTemplate: boolean().default(false).notNull(),
    fallbackReason: varchar({ length: 64 }),
    failureReason: varchar({ length: 500 }),
    lastAttemptAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('notification_delivery_dispatch_id_key').on(table.dispatchId),
    index('notification_delivery_status_updated_at_idx').on(
      table.status,
      table.updatedAt.desc(),
    ),
    index('notification_delivery_receiver_user_id_updated_at_idx').on(
      table.receiverUserId,
      table.updatedAt.desc(),
    ),
    index('notification_delivery_category_key_status_updated_at_idx').on(
      table.categoryKey,
      table.status,
      table.updatedAt.desc(),
    ),
    index('notification_delivery_event_id_idx').on(table.eventId),
  ],
)

export type NotificationDeliverySelect =
  typeof notificationDelivery.$inferSelect
export type NotificationDeliveryInsert =
  typeof notificationDelivery.$inferInsert
