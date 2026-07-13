import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 用户通知投影表。
 * 只承载通知中心对用户可见的读模型，不再承担 producer 侧通知类型事实源职责。
 */
export const userNotification = snakeCase.table(
  'user_notification',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 通知分类键。 */
    categoryKey: varchar({ length: 80 }).notNull(),
    /** 通知投影键。 */
    projectionKey: varchar({ length: 180 }).notNull(),
    /** 接收用户 ID。 */
    receiverUserId: integer().notNull(),
    /** 触发用户 ID。 */
    actorUserId: integer(),
    /** 通知标题。 */
    title: varchar({ length: 200 }).notNull(),
    /** 通知正文。 */
    content: varchar({ length: 1000 }).notNull(),
    /** 通知扩展载荷。 */
    payload: jsonb(),
    /** 公告 ID（system_announcement 场景冗余列，用于反查已通知用户）。 */
    announcementId: integer(),
    /** 是否已读。 */
    isRead: boolean().default(false).notNull(),
    /** 当前接收用户是否已隐藏。 */
    isHidden: boolean().default(false).notNull(),
    /** 已读时间。 */
    readAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 过期时间。 */
    expiresAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
    /** 保留截止时间；未读或仍可见通知必须由清理任务排除。 */
    retentionUntil: timestamp({ withTimezone: true, precision: 6 }).default(
      sql`now() + interval '180 days'`,
    ),
    /** 归档时间；为空表示仍处于热数据窗口。 */
    archivedAt: timestamp({ withTimezone: true, precision: 6 }),
  },
  (table) => [
    unique('user_notification_receiver_user_id_projection_key_key').on(
      table.receiverUserId,
      table.projectionKey,
    ),
    index('user_notification_receiver_user_id_is_read_created_at_idx').on(
      table.receiverUserId,
      table.isHidden,
      table.isRead,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('user_notification_receiver_user_id_category_key_created_at_idx').on(
      table.receiverUserId,
      table.isHidden,
      table.categoryKey,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('user_notification_receiver_user_id_created_at_idx').on(
      table.receiverUserId,
      table.isHidden,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    /**
     * 通知中心高增长路径：同时按未读状态和分类筛选时复用同一稳定分页索引。
     */
    index('user_notification_receiver_read_category_created_id_idx').on(
      table.receiverUserId,
      table.isHidden,
      table.isRead,
      table.categoryKey,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('user_notification_receiver_created_at_id_idx').on(
      table.receiverUserId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('user_notification_retention_until_id_idx').on(
      table.retentionUntil,
      table.id,
    ),
    index('user_notification_receiver_user_id_expires_at_idx').on(
      table.receiverUserId,
      table.expiresAt,
    ),
    index('user_notification_category_announcement_receiver_idx').on(
      table.categoryKey,
      table.announcementId,
      table.receiverUserId,
    ),
    index('user_notification_actor_user_id_idx').on(table.actorUserId),
    check(
      'user_notification_system_announcement_requires_id_chk',
      sql`${table.categoryKey} <> 'system_announcement' OR ${table.announcementId} IS NOT NULL`,
    ),
  ],
)

export type UserNotificationSelect = typeof userNotification.$inferSelect
export type UserNotificationInsert = typeof userNotification.$inferInsert
