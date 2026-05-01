/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  smallint,
  snakeCase,
} from 'drizzle-orm/pg-core'

/**
 * 论坛版主板块关联表 - 管理板块版主与板块的多对多关系，一个板块版主可以管理多个板块
 */
export const forumModeratorSection = snakeCase.table(
  'forum_moderator_section',
  {
    /**
     * 关联的版主ID
     */
    moderatorId: integer().notNull(),
    /**
     * 关联的板块ID
     */
    sectionId: integer().notNull(),
    /**
     * 自定义权限数组（1=置顶，2=加精，3=锁定，4=删除，5=审核，6=移动）
     */
    permissions: smallint()
      .array()
      .default(sql`ARRAY[]::smallint[]`),
  },
  (table) => [
    /**
     * 板块索引
     */
    index('forum_moderator_section_section_id_idx').on(table.sectionId),
    /**
     * 版主与板块复合主键
     */
    primaryKey({ columns: [table.moderatorId, table.sectionId] }),
    check(
      'forum_moderator_section_permissions_valid_chk',
      sql`${table.permissions} is null or ${table.permissions} <@ ARRAY[1,2,3,4,5,6]::smallint[]`,
    ),
  ],
)

export type ForumModeratorSectionSelect =
  typeof forumModeratorSection.$inferSelect
export type ForumModeratorSectionInsert =
  typeof forumModeratorSection.$inferInsert
