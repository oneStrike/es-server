import { index, integer, pgTable, smallint, timestamp, unique } from 'drizzle-orm/pg-core'

/**
 * 用户关注事实表
 * 统一记录用户对用户、作者、论坛板块等目标的单向关注关系
 */
export const appUserFollow = pgTable(
  'app_user_follow',
  {
    /**
     * 主键 ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 关注目标类型
     * 1=用户，2=作者，3=论坛板块
     */
    targetType: smallint().notNull(),
    /**
     * 关注目标 ID
     */
    targetId: integer().notNull(),
    /**
     * 发起关注的用户 ID
     */
    userId: integer().notNull(),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    /**
     * 同一用户对同一目标只能关注一次
     */
    unique('app_user_follow_target_type_target_id_user_id_key').on(
      table.targetType,
      table.targetId,
      table.userId,
    ),
    /**
     * 用户关注列表索引
     */
    index('app_user_follow_user_id_target_type_created_at_idx').on(
      table.userId,
      table.targetType,
      table.createdAt,
    ),
    /**
     * 目标粉丝列表索引
     */
    index('app_user_follow_target_type_target_id_created_at_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    /**
     * 目标存在性/状态查询索引
     */
    index('app_user_follow_target_type_target_id_idx').on(
      table.targetType,
      table.targetId,
    ),
  ],
)

export type AppUserFollowSelect = typeof appUserFollow.$inferSelect
export type AppUserFollowInsert = typeof appUserFollow.$inferInsert
