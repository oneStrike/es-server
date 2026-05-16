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
 * 作品三方来源绑定表。
 * 只承载结构化三方来源身份，不从作品展示字段推断同步资格。
 */
export const workThirdPartySourceBinding = snakeCase.table(
  'work_third_party_source_binding',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 本地作品 ID。 */
    workId: integer().notNull(),
    /** 三方平台代码。 */
    platform: varchar({ length: 30 }).notNull(),
    /** 三方漫画 ID。 */
    providerComicId: varchar({ length: 100 }).notNull(),
    /** 三方漫画路径标识。 */
    providerPathWord: varchar({ length: 100 }).notNull(),
    /** 三方章节分组路径标识。 */
    providerGroupPathWord: varchar({ length: 100 }).notNull(),
    /** 三方 UUID。 */
    providerUuid: varchar({ length: 100 }),
    /** 三方来源快照。 */
    sourceSnapshot: jsonb().notNull(),
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
    uniqueIndex('work_third_party_source_binding_work_id_live_idx')
      .on(table.workId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('work_third_party_source_binding_platform_comic_group_live_idx')
      .on(table.platform, table.providerComicId, table.providerGroupPathWord)
      .where(sql`${table.deletedAt} is null`),
    index('work_third_party_source_binding_platform_path_group_idx').on(
      table.platform,
      table.providerPathWord,
      table.providerGroupPathWord,
    ),
    index('work_third_party_source_binding_deleted_at_idx').on(table.deletedAt),
    check(
      'work_third_party_source_binding_platform_nonblank_chk',
      sql`length(trim(${table.platform})) > 0`,
    ),
    check(
      'work_third_party_source_binding_provider_comic_id_nonblank_chk',
      sql`length(trim(${table.providerComicId})) > 0`,
    ),
    check(
      'work_third_party_source_binding_provider_path_word_nonblank_chk',
      sql`length(trim(${table.providerPathWord})) > 0`,
    ),
    check(
      'work_third_party_source_binding_provider_group_path_word_nonblank_chk',
      sql`length(trim(${table.providerGroupPathWord})) > 0`,
    ),
  ],
)

export type WorkThirdPartySourceBindingSelect =
  typeof workThirdPartySourceBinding.$inferSelect
export type WorkThirdPartySourceBindingInsert =
  typeof workThirdPartySourceBinding.$inferInsert
