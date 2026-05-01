/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  smallint,
  snakeCase,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 论坛版主操作日志表 - 记录版主的所有操作行为，包括主题管理、回复管理、审核等操作
 */
export const forumModeratorActionLog = snakeCase.table(
  'forum_moderator_action_log',
  {
    /**
     * 主键ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 关联的版主ID
     */
    moderatorId: integer().notNull(),
    /**
     * 目标ID
     */
    targetId: integer().notNull(),
    /**
     * 操作类型（1=置顶主题, 2=取消置顶, 3=加精主题, 4=取消加精, 5=锁定主题, 6=取消锁定主题, 7=删除主题, 8=移动主题, 9=审核主题, 10=删除评论, 11=隐藏主题, 12=取消隐藏主题, 13=审核评论, 14=隐藏评论, 15=取消隐藏评论）
     */
    actionType: smallint().notNull(),
    /**
     * 目标类型（1=论坛主题, 2=论坛评论）
     */
    targetType: smallint().notNull(),
    /**
     * 操作描述
     */
    actionDescription: varchar({ length: 200 }).notNull(),
    /**
     * 操作前数据（JSON格式）
     */
    beforeData: text(),
    /**
     * 操作后数据（JSON格式）
     */
    afterData: text(),
    /**
     * 操作时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    /**
     * 版主索引
     */
    index('forum_moderator_action_log_moderator_id_idx').on(table.moderatorId),
    /**
     * 操作类型索引
     */
    index('forum_moderator_action_log_action_type_idx').on(table.actionType),
    /**
     * 操作类型闭集约束
     */
    check(
      'forum_moderator_action_log_action_type_valid_chk',
      sql`${table.actionType} in (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15)`,
    ),
    /**
     * 目标类型与目标ID索引
     */
    index('forum_moderator_action_log_target_type_target_id_idx').on(
      table.targetType,
      table.targetId,
    ),
    /**
     * 目标类型闭集约束
     */
    check(
      'forum_moderator_action_log_target_type_valid_chk',
      sql`${table.targetType} in (1, 2)`,
    ),
    /**
     * 创建时间索引
     */
    index('forum_moderator_action_log_created_at_idx').on(table.createdAt),
  ],
)
