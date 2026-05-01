/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 论坛版主表 - 管理论坛版主信息，包括角色类型、权限设置、启用状态等
 */
export const forumModerator = snakeCase.table(
  'forum_moderator',
  {
    /**
     * 主键ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 关联的用户ID
     */
    userId: integer().notNull(),
    /**
     * 关联的分组ID（分组版主时必填）
     */
    groupId: integer(),
    /**
     * 版主角色类型（1=超级版主，2=分组版主，3=板块版主）
     */
    roleType: smallint().default(3).notNull(),
    /**
     * 权限数组（1=置顶, 2=加精, 3=锁定, 4=删除, 5=审核, 6=移动）
     */
    permissions: smallint()
      .array()
      .default(sql`ARRAY[]::smallint[]`),
    /**
     * 是否启用
     */
    isEnabled: boolean().default(true).notNull(),
    /**
     * 备注
     */
    remark: varchar({ length: 500 }),
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
    /**
     * 软删除时间
     */
    deletedAt: timestamp({ withTimezone: true, precision: 6 }),
  },
  (table) => [
    /**
     * 唯一索引: userId
     */
    unique('forum_moderator_user_id_key').on(table.userId),
    /**
     * 分组索引
     */
    index('forum_moderator_group_id_idx').on(table.groupId),
    /**
     * 角色类型索引
     */
    index('forum_moderator_role_type_idx').on(table.roleType),
    /**
     * 启用状态索引
     */
    index('forum_moderator_is_enabled_idx').on(table.isEnabled),
    /**
     * 创建时间索引
     */
    index('forum_moderator_created_at_idx').on(table.createdAt),
    /**
     * 删除时间索引
     */
    index('forum_moderator_deleted_at_idx').on(table.deletedAt),
    check(
      'forum_moderator_role_type_valid_chk',
      sql`${table.roleType} in (1, 2, 3)`,
    ),
    check(
      'forum_moderator_permissions_valid_chk',
      sql`${table.permissions} is null or ${table.permissions} <@ ARRAY[1,2,3,4,5,6]::smallint[]`,
    ),
  ],
)

export type ForumModeratorSelect = typeof forumModerator.$inferSelect
export type ForumModeratorInsert = typeof forumModerator.$inferInsert
