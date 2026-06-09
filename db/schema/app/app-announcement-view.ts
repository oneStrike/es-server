/**
 * Auto-converted from legacy schema.
 */

import {
  index,
  integer,
  primaryKey,
  snakeCase,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * 系统公告浏览记录表。
 * 用于按用户去重公告浏览次数，避免接口重试或刷新重复累加。
 */
export const appAnnouncementView = snakeCase.table(
  'app_announcement_view',
  {
    /** 关联的公告 ID。 */
    announcementId: integer().notNull(),
    /** 浏览用户 ID。 */
    userId: integer().notNull(),
    /** 首次浏览时间。 */
    viewedAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('app_announcement_view_user_id_viewed_at_idx').on(
      table.userId,
      table.viewedAt.desc(),
    ),
    primaryKey({ columns: [table.announcementId, table.userId] }),
  ],
)

export type AppAnnouncementViewSelect = typeof appAnnouncementView.$inferSelect
export type AppAnnouncementViewInsert = typeof appAnnouncementView.$inferInsert
