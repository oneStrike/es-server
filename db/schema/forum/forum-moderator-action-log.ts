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
    moderatorId: integer(),
    /**
     * 治理动作来源（1=版主；2=后台管理员）
     */
    actorType: smallint().default(1).notNull(),
    /**
     * 治理动作发起用户ID。
     * moderator 来源写 moderatorUserId，admin 来源写后台管理员用户ID。
     */
    actorUserId: integer(),
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
    index('forum_governance_action_log_actor_created_at_idx').on(
      table.actorType,
      table.actorUserId,
      table.createdAt.desc(),
    ),
    index('forum_moderator_action_log_moderator_created_at_idx').on(
      table.moderatorId,
      table.createdAt.desc(),
    ),
    /**
     * 操作类型索引
     */
    index('forum_moderator_action_log_action_type_idx').on(table.actionType),
    index('forum_moderator_action_log_action_type_created_at_idx').on(
      table.actionType,
      table.createdAt.desc(),
    ),
    /**
     * 操作类型闭集约束
     */
    check(
      'forum_moderator_action_log_action_type_valid_chk',
      sql`${table.actionType} in (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16)`,
    ),
    check(
      'forum_governance_action_log_actor_type_valid_chk',
      sql`${table.actorType} in (1, 2)`,
    ),
    check(
      'forum_governance_action_log_actor_user_present_chk',
      sql`${table.actorUserId} is not null`,
    ),
    check(
      'forum_governance_action_log_moderator_presence_chk',
      sql`(${table.actorType} = 1 and ${table.moderatorId} is not null) or (${table.actorType} = 2 and ${table.moderatorId} is null)`,
    ),
    /**
     * 目标类型与目标ID索引
     */
    index('forum_moderator_action_log_target_type_target_id_idx').on(
      table.targetType,
      table.targetId,
    ),
    index('forum_moderator_action_log_target_created_at_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt.desc(),
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
    index('forum_moderator_action_log_created_at_idx').on(
      table.createdAt.desc(),
    ),
  ],
)
