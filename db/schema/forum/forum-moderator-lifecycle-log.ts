import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 论坛版主生命周期日志表。
 *
 * 独立记录版主身份创建、恢复、授权变更、禁用、移除和申请审核事实，
 * 不与 topic/comment 治理操作日志混用。
 */
export const forumModeratorLifecycleLog = snakeCase.table(
  'forum_moderator_lifecycle_log',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 生命周期事件类型。 */
    eventType: smallint().notNull(),
    /** 关联版主 ID；申请拒绝场景可为空。 */
    moderatorId: integer(),
    /** 关联申请 ID；非申请来源场景可为空。 */
    applicationId: integer(),
    /** 后台操作者用户 ID。 */
    actorAdminUserId: integer().notNull(),
    /** 操作原因或审核意见。 */
    reason: varchar({ length: 500 }),
    /** 操作前快照。 */
    beforeData: jsonb(),
    /** 操作后快照。 */
    afterData: jsonb(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('forum_moderator_lifecycle_log_moderator_created_at_idx').on(
      table.moderatorId,
      table.createdAt.desc(),
    ),
    index('forum_moderator_lifecycle_log_application_created_at_idx').on(
      table.applicationId,
      table.createdAt.desc(),
    ),
    index('forum_moderator_lifecycle_log_event_type_created_at_idx').on(
      table.eventType,
      table.createdAt.desc(),
    ),
    index('forum_moderator_lifecycle_log_created_at_idx').on(
      table.createdAt.desc(),
    ),
    check(
      'forum_moderator_lifecycle_log_event_type_valid_chk',
      sql`${table.eventType} in (1,2,3,4,5,6,7,8,9)`,
    ),
    check(
      'forum_moderator_lifecycle_log_actor_admin_user_id_positive_chk',
      sql`${table.actorAdminUserId} > 0`,
    ),
    check(
      'forum_moderator_lifecycle_log_moderator_id_positive_chk',
      sql`${table.moderatorId} is null or ${table.moderatorId} > 0`,
    ),
    check(
      'forum_moderator_lifecycle_log_application_id_positive_chk',
      sql`${table.applicationId} is null or ${table.applicationId} > 0`,
    ),
    check(
      'forum_moderator_lifecycle_log_subject_present_chk',
      sql`${table.moderatorId} is not null or ${table.applicationId} is not null`,
    ),
  ],
)

export type ForumModeratorLifecycleLogSelect =
  typeof forumModeratorLifecycleLog.$inferSelect
export type ForumModeratorLifecycleLogInsert =
  typeof forumModeratorLifecycleLog.$inferInsert
