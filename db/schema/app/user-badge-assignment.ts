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
 * 用户徽章关联表 - 管理用户获得的徽章
 */
export const userBadgeAssignment = snakeCase.table(
  'user_badge_assignment',
  {
    /**
     * 关联的用户ID
     */
    userId: integer().notNull(),
    /**
     * 关联的徽章ID
     */
    badgeId: integer().notNull(),
    /**
     * 获得时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    /**
     * 徽章与获得时间索引
     */
    index('user_badge_assignment_badge_id_created_at_idx').on(
      table.badgeId,
      table.createdAt.desc(),
    ),
    /**
     * 用户与获得时间索引
     */
    index('user_badge_assignment_user_id_created_at_idx').on(
      table.userId,
      table.createdAt.desc(),
    ),
    /**
     * 用户与徽章复合主键
     */
    primaryKey({ columns: [table.userId, table.badgeId] }),
  ],
)
