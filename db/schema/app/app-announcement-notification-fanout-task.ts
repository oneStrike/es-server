import {
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

export const appAnnouncementNotificationFanoutTask = pgTable(
  'app_announcement_notification_fanout_task',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    announcementId: integer().notNull(),
    desiredEventKey: varchar({ length: 120 }).notNull(),
    status: varchar({ length: 32 }).notNull(),
    cursorUserId: integer(),
    lastError: varchar({ length: 500 }),
    startedAt: timestamp({ withTimezone: true, precision: 6 }),
    finishedAt: timestamp({ withTimezone: true, precision: 6 }),
    createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  },
  table => [
    unique('app_announcement_notification_fanout_task_announcement_id_key').on(
      table.announcementId,
    ),
    index('app_announcement_notification_fanout_task_status_idx').on(
      table.status,
    ),
    index(
      'app_announcement_notification_fanout_task_status_updated_at_idx',
    ).on(table.status, table.updatedAt.desc()),
  ],
)

export type AppAnnouncementNotificationFanoutTaskSelect =
  typeof appAnnouncementNotificationFanoutTask.$inferSelect
export type AppAnnouncementNotificationFanoutTaskInsert =
  typeof appAnnouncementNotificationFanoutTask.$inferInsert
