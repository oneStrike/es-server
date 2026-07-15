import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 用户举报记录表
 * 统一存储作品、章节、论坛主题、评论、用户的举报行为
 */
export const userReport = snakeCase.table(
  'user_report',
  {
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
     * 举报直接目标类型（1=漫画作品，2=小说作品，3=漫画章节，4=小说章节，5=论坛主题，6=评论，7=用户）
     */
    targetType: smallint().notNull(),
    /**
     * 举报直接目标 ID
     */
    targetId: integer().notNull(),
    /**
     * 目标所属业务场景类型（1=漫画作品场景，2=小说作品场景，3=论坛主题场景，10=漫画章节场景，11=小说章节场景，12=用户主页场景）
     */
    sceneType: smallint().notNull(),
    /**
     * 目标所属业务场景根对象 ID
     * 例如评论举报时，这里存评论挂载的作品、章节或主题 ID
     */
    sceneId: integer().notNull(),
    /**
     * 评论层级类型（1=根评论，2=回复评论）
     * 仅当 targetType=评论时有值。
     */
    commentLevel: smallint(),
    /**
     * 举报原因类型（1=垃圾信息，2=不当内容，3=骚扰，4=版权侵权，99=其他）
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
     * 举报状态（1=待处理，2=处理中，3=已解决，4=已驳回）
     */
    status: smallint().default(1).notNull(),
    /**
     * 处理备注
     */
    handlingNote: varchar({ length: 500 }),
    /**
     * 目标处置动作（1=无需处置，2=隐藏评论，3=拒绝评论，4=隐藏论坛主题，5=拒绝论坛主题，6=禁用用户，7=禁言用户）
     */
    targetAction: smallint().default(1).notNull(),
    /**
     * 目标处置原因。
     */
    targetActionReason: varchar({ length: 500 }),
    /**
     * 最终目标处置状态（1=无需处置，2=已处置）。
     */
    targetActionStatus: smallint().default(1).notNull(),
    /**
     * owner service 返回的结构化处置结果。
     */
    targetActionResult: jsonb(),
    /**
     * 目标处置完成时间。
     */
    targetActionAppliedAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 处理时间
     */
    handledAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /**
     * 更新时间
     */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /**
     * 同一用户对同一目标只允许举报一次
     */
    unique('user_report_reporter_id_target_type_target_id_key').on(
      table.reporterId,
      table.targetType,
      table.targetId,
    ),
    /**
     * 直接目标查询索引
     */
    index('user_report_target_type_target_id_idx').on(
      table.targetType,
      table.targetId,
    ),
    /**
     * 管理端目标维度默认排序索引
     */
    index('user_report_target_created_at_id_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    /**
     * 场景状态查询索引
     */
    index('user_report_scene_type_scene_id_status_idx').on(
      table.sceneType,
      table.sceneId,
      table.status,
    ),
    /**
     * 场景时间统计索引
     */
    index('user_report_scene_type_status_created_at_idx').on(
      table.sceneType,
      table.status,
      table.createdAt,
    ),
    /**
     * 原因统计索引
     */
    index('user_report_reason_type_status_created_at_idx').on(
      table.reasonType,
      table.status,
      table.createdAt,
    ),
    /**
     * 处理维度查询索引
     */
    index('user_report_handler_id_status_handled_at_idx').on(
      table.handlerId,
      table.status,
      table.handledAt,
    ),
    /**
     * 管理端状态列表索引
     */
    index('user_report_status_created_at_id_idx').on(
      table.status,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    /**
     * 管理端举报人筛选索引
     */
    index('user_report_reporter_created_at_id_idx').on(
      table.reporterId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    /**
     * 管理端处理人筛选索引
     */
    index('user_report_handler_status_created_at_id_idx').on(
      table.handlerId,
      table.status,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    /**
     * 管理端最终处置状态筛选索引
     */
    index('user_report_disposition_status_created_at_id_idx').on(
      table.targetActionStatus,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    /**
     * 创建时间索引
     */
    index('user_report_created_at_idx').on(table.createdAt),
    check(
      'user_report_target_type_valid_chk',
      sql`${table.targetType} in (1, 2, 3, 4, 5, 6, 7)`,
    ),
    check(
      'user_report_scene_type_valid_chk',
      sql`${table.sceneType} in (1, 2, 3, 10, 11, 12)`,
    ),
    check(
      'user_report_comment_level_valid_chk',
      sql`${table.commentLevel} is null or ${table.commentLevel} in (1, 2)`,
    ),
    check(
      'user_report_reason_type_valid_chk',
      sql`${table.reasonType} in (1, 2, 3, 4, 99)`,
    ),
    check('user_report_status_valid_chk', sql`${table.status} in (1, 2, 3, 4)`),
    check(
      'user_report_target_action_valid_chk',
      sql`${table.targetAction} in (1, 2, 3, 4, 5, 6, 7)`,
    ),
    check(
      'user_report_target_action_status_valid_chk',
      sql`${table.targetActionStatus} in (1, 2)`,
    ),
  ],
)

export type UserReportSelect = typeof userReport.$inferSelect
export type UserReportInsert = typeof userReport.$inferInsert
