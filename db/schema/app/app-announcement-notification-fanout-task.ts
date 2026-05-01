import { sql } from 'drizzle-orm'
import {
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
 * 公告通知扇出任务表。
 * 用于记录公告消息中心通知的扇出进度。
 */
export const appAnnouncementNotificationFanoutTask = snakeCase.table(
  'app_announcement_notification_fanout_task',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 公告 ID。 */
    announcementId: integer().notNull(),
    /** 目标事件键。 */
    desiredEventKey: varchar({ length: 120 }).notNull(),
    /** 任务状态（0=待处理，1=处理中，2=成功，3=失败）。 */
    status: smallint().notNull(),
    /** 当前游标用户 ID。 */
    cursorUserId: integer(),
    /** 最近一次错误信息。 */
    lastError: varchar({ length: 500 }),
    /** 开始处理时间。 */
    startedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 完成处理时间。 */
    finishedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('app_announcement_notification_fanout_task_announcement_id_key').on(
      table.announcementId,
    ),
    index('app_announcement_notification_fanout_task_status_idx').on(
      table.status,
    ),
    index('app_announcement_notification_fanout_task_status_updated_at_idx').on(
      table.status,
      table.updatedAt.desc(),
    ),
    check(
      'app_announcement_notification_fanout_task_status_valid_chk',
      sql`${table.status} in (0, 1, 2, 3)`,
    ),
  ],
)

export type AppAnnouncementNotificationFanoutTaskSelect =
  typeof appAnnouncementNotificationFanoutTask.$inferSelect
export type AppAnnouncementNotificationFanoutTaskInsert =
  typeof appAnnouncementNotificationFanoutTask.$inferInsert
