/**
 * Auto-converted from legacy schema.
 */

import { index, integer, pgTable, smallint, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * 用户点赞记录表
 * 统一存储作品、章节、论坛主题、评论的点赞行为
 */
export const appUserLike = pgTable("app_user_like", {
  /**
   * 主键 ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 点赞直接目标类型
   * 取值见 like 模块的 LikeTargetTypeEnum
   */
  targetType: smallint().notNull(),
  /**
   * 点赞直接目标 ID
   */
  targetId: integer().notNull(),
  /**
   * 目标所属业务场景类型
   * 取值见 SceneTypeEnum
   */
  sceneType: smallint().notNull(),
  /**
   * 目标所属业务场景根对象 ID
   * 例如评论点赞时，这里存评论挂载的作品、章节或主题 ID
   */
  sceneId: integer().notNull(),
  /**
   * 评论层级类型
   * 仅当 targetType=COMMENT 时有值
   * 取值见 CommentLevelEnum
   */
  commentLevel: smallint(),
  /**
   * 点赞用户 ID
   */
  userId: integer().notNull(),
  /**
   * 点赞时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
    /**
     * 同一用户对同一目标只允许点赞一次
     */
    unique("app_user_like_target_type_target_id_user_id_key").on(table.targetType, table.targetId, table.userId),
    /**
     * 直接目标查询索引
     */
    index("app_user_like_target_type_target_id_idx").on(table.targetType, table.targetId),
    /**
     * 场景维度统计索引
     */
    index("app_user_like_scene_type_scene_id_idx").on(table.sceneType, table.sceneId),
    /**
     * 用户场景查询索引
     */
    index("app_user_like_user_id_scene_type_created_at_idx").on(table.userId, table.sceneType, table.createdAt),
    /**
     * 创建时间索引
     */
    index("app_user_like_created_at_idx").on(table.createdAt),
]);

export type AppUserLikeSelect = typeof appUserLike.$inferSelect;
export type AppUserLikeInsert = typeof appUserLike.$inferInsert;
