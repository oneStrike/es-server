/**
 * Auto-converted from Prisma schema.
 */

import { index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 用户举报记录表
 * 统一存储作品、章节、论坛主题、评论、用户的举报行为
 */
export const userReport = pgTable("user_report", {
  /**
   * 主键 ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 举报人 ID
   */
  reporterId: integer().notNull(),
  /**
   * 处理人 ID
   */
  handlerId: integer(),
  /**
   * 举报直接目标类型
   * 取值见 ReportTargetTypeEnum
   */
  targetType: smallint().notNull(),
  /**
   * 举报直接目标 ID
   */
  targetId: integer().notNull(),
  /**
   * 目标所属业务场景类型
   * 取值见 SceneTypeEnum
   */
  sceneType: smallint().notNull(),
  /**
   * 目标所属业务场景根对象 ID
   * 例如评论举报时，这里存评论挂载的作品、章节或主题 ID
   */
  sceneId: integer().notNull(),
  /**
   * 评论层级类型
   * 仅当 targetType=COMMENT 时有值
   * 取值见 CommentLevelEnum
   */
  commentLevel: smallint(),
  /**
   * 举报原因类型
   * 取值见 ReportReasonEnum
   */
  reasonType: smallint().notNull(),
  /**
   * 举报补充说明
   */
  description: varchar({ length: 500 }),
  /**
   * 证据链接
   */
  evidenceUrl: varchar({ length: 500 }),
  /**
   * 举报状态
   * 取值见 ReportStatusEnum
   */
  status: smallint().default(1).notNull(),
  /**
   * 处理备注
   */
  handlingNote: varchar({ length: 500 }),
  /**
   * 处理时间
   */
  handledAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
    /**
     * 同一用户对同一目标只允许举报一次
     */
    unique("user_report_reporter_id_target_type_target_id_key").on(table.reporterId, table.targetType, table.targetId),
    /**
     * 直接目标查询索引
     */
    index("user_report_target_type_target_id_idx").on(table.targetType, table.targetId),
    /**
     * 场景状态查询索引
     */
    index("user_report_scene_type_scene_id_status_idx").on(table.sceneType, table.sceneId, table.status),
    /**
     * 场景时间统计索引
     */
    index("user_report_scene_type_status_created_at_idx").on(table.sceneType, table.status, table.createdAt),
    /**
     * 原因统计索引
     */
    index("user_report_reason_type_status_created_at_idx").on(table.reasonType, table.status, table.createdAt),
    /**
     * 处理维度查询索引
     */
    index("user_report_handler_id_status_handled_at_idx").on(table.handlerId, table.status, table.handledAt),
    /**
     * 创建时间索引
     */
    index("user_report_created_at_idx").on(table.createdAt),
]);
