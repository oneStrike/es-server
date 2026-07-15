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
    /** 生命周期边界键。 */
    eventBoundaryKey: varchar({ length: 160 }).notNull(),
    /** 扇出任务幂等键。 */
    fanoutKey: varchar({ length: 320 }).notNull(),
    /** 任务状态（0=待处理，1=处理中，2=成功，3=失败）。 */
    status: smallint().notNull(),
    /** 处理尝试次数。 */
    attemptCount: integer().default(0).notNull(),
    /** 当前游标用户 ID。 */
    cursorUserId: integer(),
    /** 最近一次错误信息。 */
    lastError: varchar({ length: 500 }),
    /** 开始处理时间。 */
    startedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 处理租约过期时间。 */
    processingLeaseExpiresAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 下次允许重试时间。 */
    nextAttemptAt: timestamp({ withTimezone: true, precision: 6 }),
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
    unique('app_announcement_notification_fanout_task_fanout_key_key').on(
      table.fanoutKey,
    ),
    index('app_announcement_fanout_pending_idx')
      .on(table.status, table.updatedAt, table.id)
      .where(sql`${table.status} = 0`),
    index('app_announcement_fanout_failed_retry_idx')
      .on(
        table.status,
        table.nextAttemptAt,
        table.attemptCount,
        table.updatedAt,
        table.id,
      )
      .where(sql`${table.status} = 3`),
    index('app_announcement_fanout_lease_expired_idx')
      .on(
        table.status,
        table.processingLeaseExpiresAt,
        table.updatedAt,
        table.id,
      )
      .where(sql`${table.status} = 1`),
    index('app_announcement_notification_fanout_task_announcement_idx').on(
      table.announcementId,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    check(
      'app_ann_fanout_task_status_valid_chk',
      sql`${table.status} in (0, 1, 2, 3)`,
    ),
    check(
      'app_ann_fanout_task_attempt_count_chk',
      sql`${table.attemptCount} >= 0`,
    ),
    check(
      'app_ann_fanout_task_fanout_key_not_blank_chk',
      sql`btrim(${table.fanoutKey}) <> ''`,
    ),
    check(
      'app_ann_fanout_task_boundary_key_not_blank_chk',
      sql`btrim(${table.eventBoundaryKey}) <> ''`,
    ),
    check(
      'app_ann_fanout_task_manual_boundary_format_chk',
      sql`${table.eventBoundaryKey} !~ '^manual:legacy:'`,
    ),
  ],
)

export type AppAnnouncementNotificationFanoutTaskSelect =
  typeof appAnnouncementNotificationFanoutTask.$inferSelect
export type AppAnnouncementNotificationFanoutTaskInsert =
  typeof appAnnouncementNotificationFanoutTask.$inferInsert
