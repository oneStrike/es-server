import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  snakeCase,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 作品三方章节绑定表。
 * 用 provider 章节 ID 提供后续同步幂等依据。
 */
export const workThirdPartyChapterBinding = snakeCase.table(
  'work_third_party_chapter_binding',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 三方来源绑定 ID。 */
    workThirdPartySourceBindingId: integer().notNull(),
    /** 本地章节 ID。 */
    chapterId: integer().notNull(),
    /** 三方章节 ID。 */
    providerChapterId: varchar({ length: 100 }).notNull(),
    /** 三方章节原始排序。 */
    remoteSortOrder: integer(),
    /** 三方章节快照。 */
    snapshot: jsonb().notNull(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
    /** 删除时间。 */
    deletedAt: timestamp({ withTimezone: true, precision: 6 }),
  },
  (table) => [
    uniqueIndex(
      'work_third_party_chapter_binding_source_provider_chapter_live_idx',
    )
      .on(table.workThirdPartySourceBindingId, table.providerChapterId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('work_third_party_chapter_binding_chapter_id_live_idx')
      .on(table.chapterId)
      .where(sql`${table.deletedAt} is null`),
    index('work_third_party_chapter_binding_source_created_at_idx').on(
      table.workThirdPartySourceBindingId,
      table.createdAt,
    ),
    index('work_third_party_chapter_binding_deleted_at_idx').on(
      table.deletedAt,
    ),
    check(
      'work_third_party_chapter_binding_provider_chapter_id_nonblank_chk',
      sql`length(trim(${table.providerChapterId})) > 0`,
    ),
  ],
)

export type WorkThirdPartyChapterBindingSelect =
  typeof workThirdPartyChapterBinding.$inferSelect
export type WorkThirdPartyChapterBindingInsert =
  typeof workThirdPartyChapterBinding.$inferInsert
