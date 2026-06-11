import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  smallint,
  snakeCase,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 用户评论根楼层计数表。
 *
 * 以目标维度单行计数替代 user_comment 的 max(floor)+1 扫描，
 * 保证同一评论目标下根评论楼层在并发写入时单调且不重复。
 */
export const userCommentFloorCounter = snakeCase.table(
  'user_comment_floor_counter',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 评论目标类型。 */
    targetType: smallint().notNull(),
    /** 评论目标 ID。 */
    targetId: integer().notNull(),
    /** 下一次分配的根评论楼层号。 */
    nextFloor: integer().default(1).notNull(),
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
    unique('user_comment_floor_counter_target_key').on(
      table.targetType,
      table.targetId,
    ),
    index('user_comment_floor_counter_target_next_floor_idx').on(
      table.targetType,
      table.targetId,
      table.nextFloor,
    ),
    check(
      'user_comment_floor_counter_target_type_valid_chk',
      sql`${table.targetType} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'user_comment_floor_counter_target_id_positive_chk',
      sql`${table.targetId} > 0`,
    ),
    check(
      'user_comment_floor_counter_next_floor_positive_chk',
      sql`${table.nextFloor} > 0`,
    ),
  ],
)

export type UserCommentFloorCounterSelect =
  typeof userCommentFloorCounter.$inferSelect
export type UserCommentFloorCounterInsert =
  typeof userCommentFloorCounter.$inferInsert
