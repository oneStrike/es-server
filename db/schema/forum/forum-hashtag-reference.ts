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
} from 'drizzle-orm/pg-core'

/**
 * forum 话题引用事实表
 * 记录 hashtag 与 forum topic / forum topic comment 的当前引用关系。
 */
export const forumHashtagReference = snakeCase.table(
  'forum_hashtag_reference',
  {
    /**
     * 主键 ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 话题资源 ID
     */
    hashtagId: integer().notNull(),
    /**
     * 来源类型
     * 1=forum_topic，2=forum_topic_comment。
     */
    sourceType: smallint().notNull(),
    /**
     * 来源 ID
     */
    sourceId: integer().notNull(),
    /**
     * 所属主题 ID
     * topic 引用时等于 sourceId；comment 引用时指向根 topic。
     */
    topicId: integer().notNull(),
    /**
     * 所属板块 ID
     */
    sectionId: integer().notNull(),
    /**
     * 来源作者用户 ID
     */
    userId: integer().notNull(),
    /**
     * 同一来源内的出现次数
     * 仅记录 occurrence，不直接参与聚合累乘。
     */
    occurrenceCount: smallint().default(1).notNull(),
    /**
     * 来源审核状态
     * 0=待审核，1=已通过，2=已拒绝。
     */
    sourceAuditStatus: smallint().notNull(),
    /**
     * 来源是否隐藏
     */
    sourceIsHidden: boolean().default(false).notNull(),
    /**
     * 来源当前是否公开可见
     */
    isSourceVisible: boolean().default(false).notNull(),
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
    unique('forum_hashtag_reference_unique_key').on(
      table.hashtagId,
      table.sourceType,
      table.sourceId,
    ),
    index('forum_hashtag_reference_hashtag_visible_created_idx').on(
      table.hashtagId,
      table.isSourceVisible,
      table.createdAt,
    ),
    index('forum_hashtag_reference_source_idx').on(
      table.sourceType,
      table.sourceId,
    ),
    index('forum_hashtag_reference_topic_created_idx').on(
      table.topicId,
      table.createdAt,
    ),
    index('forum_hashtag_reference_section_created_idx').on(
      table.sectionId,
      table.createdAt,
    ),
    check(
      'forum_hashtag_reference_source_type_valid_chk',
      sql`${table.sourceType} in (1, 2)`,
    ),
    check(
      'forum_hashtag_reference_source_audit_status_valid_chk',
      sql`${table.sourceAuditStatus} in (0, 1, 2)`,
    ),
    check(
      'forum_hashtag_reference_occurrence_count_positive_chk',
      sql`${table.occurrenceCount} > 0`,
    ),
  ],
)

export type ForumHashtagReferenceSelect =
  typeof forumHashtagReference.$inferSelect
export type ForumHashtagReferenceInsert =
  typeof forumHashtagReference.$inferInsert
