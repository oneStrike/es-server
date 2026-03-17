/**
 * Auto-converted from legacy schema.
 */

import { index, integer, pgTable, smallint, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 用户浏览记录表
 * 记录用户对各类目标（漫画、小说、章节、论坛主题）的浏览行为
 * 用于浏览历史查询、热度统计、推荐算法等
 * 支持用户删除浏览记录
 */
export const userBrowseLog = pgTable("user_browse_log", {
  /**
   * 主键ID（自增）
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 目标类型
   * 1=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题
   * 注意：作品必须区分漫画(1)和小说(2)，不能使用通用类型
   */
  targetType: smallint().notNull(),
  /**
   * 目标ID
   * 关联的具体目标记录ID
   * - targetType=1/2 时：work.id
   * - targetType=3/4 时：work_chapter.id
   * - targetType=5 时：forum_topic.id
   */
  targetId: integer().notNull(),
  /**
   * 用户ID（关联 app_user.id）
   * 执行浏览操作的用户
   */
  userId: integer().notNull(),
  /**
   * IP地址
   * 用户浏览时的IP地址，用于地域统计、风控等
   */
  ipAddress: varchar({ length: 45 }),
  /**
   * 设备类型
   * 用户使用的设备类型，如：mobile、desktop、tablet
   * 用于设备统计和适配分析
   */
  device: varchar({ length: 200 }),
  /**
   * 用户代理
   * 浏览器User-Agent字符串，用于详细的设备和浏览器分析
   */
  userAgent: varchar({ length: 500 }),
  /**
   * 浏览时间
   */
  viewedAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
  /**
   * 目标类型与目标ID联合索引，用于查询某目标的浏览记录
   */
  index("user_browse_log_target_type_target_id_idx").on(table.targetType, table.targetId),
  /**
   * 用户ID索引，用于查询某用户的浏览历史
   */
  index("user_browse_log_user_id_idx").on(table.userId),
  /**
   * 浏览时间索引，用于按时间排序和清理过期数据
   */
  index("user_browse_log_viewed_at_idx").on(table.viewedAt),
  /**
   * 目标与用户联合索引，用于查询某用户对某目标的浏览记录
   */
  index("user_browse_log_target_type_target_id_user_id_idx").on(table.targetType, table.targetId, table.userId),
  /**
   * 用户与浏览时间联合索引，用于查询用户浏览历史并按时间排序
   */
  index("user_browse_log_user_id_viewed_at_idx").on(table.userId, table.viewedAt),
]);
