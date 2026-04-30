/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 用户点赞记录表
 * 统一存储作品、章节、论坛主题、评论的点赞行为
 */
export const userLike = pgTable(
  'user_like',
  {
    /**
     * 主键 ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 点赞直接目标类型（1=漫画作品，2=小说作品，3=论坛主题，4=漫画章节，5=小说章节，6=评论）
     */
    targetType: smallint().notNull(),
    /**
     * 点赞直接目标 ID
     */
    targetId: integer().notNull(),
    /**
     * 目标所属业务场景类型（1=漫画作品场景，2=小说作品场景，3=论坛主题场景，10=漫画章节场景，11=小说章节场景，12=用户主页场景）
     */
    sceneType: smallint().notNull(),
    /**
     * 目标所属业务场景根对象 ID
     * 例如评论点赞时，这里存评论挂载的作品、章节或主题 ID
     */
    sceneId: integer().notNull(),
    /**
     * 评论层级类型（1=根评论，2=回复评论）
     * 仅当 targetType=评论时有值。
     */
    commentLevel: smallint(),
    /**
     * 点赞用户 ID
     */
    userId: integer().notNull(),
    /**
     * 点赞时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    /**
     * 同一用户对同一目标只允许点赞一次
     */
    unique('user_like_target_type_target_id_user_id_key').on(
      table.targetType,
      table.targetId,
      table.userId,
    ),
    /**
     * 直接目标查询索引
     */
    index('user_like_target_type_target_id_idx').on(
      table.targetType,
      table.targetId,
    ),
    /**
     * 场景维度统计索引
     */
    index('user_like_scene_type_scene_id_idx').on(
      table.sceneType,
      table.sceneId,
    ),
    /**
     * 用户场景查询索引
     */
    index('user_like_user_id_scene_type_created_at_idx').on(
      table.userId,
      table.sceneType,
      table.createdAt,
    ),
    /**
     * 创建时间索引
     */
    index('user_like_created_at_idx').on(table.createdAt),
    /**
     * 点赞目标类型闭集约束
     */
    check(
      'user_like_target_type_valid_chk',
      sql`${table.targetType} in (1, 2, 3, 4, 5, 6)`,
    ),
    /**
     * 点赞场景类型闭集约束
     */
    check(
      'user_like_scene_type_valid_chk',
      sql`${table.sceneType} in (1, 2, 3, 10, 11, 12)`,
    ),
    /**
     * 评论层级闭集约束；非评论目标允许为空
     */
    check(
      'user_like_comment_level_valid_chk',
      sql`${table.commentLevel} is null or ${table.commentLevel} in (1, 2)`,
    ),
  ],
)

export type UserLikeSelect = typeof userLike.$inferSelect
export type UserLikeInsert = typeof userLike.$inferInsert
