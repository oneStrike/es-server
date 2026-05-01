import { sql } from 'drizzle-orm'
import {
  boolean,
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
 * forum 话题（hashtag）资源表
 * 统一承载 forum 域内全局唯一、跨版块归一聚合的话题资源。
 */
export const forumHashtag = snakeCase.table(
  'forum_hashtag',
  {
    /**
     * 主键 ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 归一化 slug
     * 去掉前导 `#` 后做标准化处理，作为全局唯一键。
     */
    slug: varchar({ length: 64 }).notNull(),
    /**
     * 展示名称
     * 当前 v1 视为创建后不可变，避免历史正文 plainText 漂移。
     */
    displayName: varchar({ length: 64 }).notNull(),
    /**
     * 运营描述
     */
    description: varchar({ length: 200 }),
    /**
     * 人工热度加权
     * 0=无人工加权。
     */
    manualBoost: smallint().default(0).notNull(),
    /**
     * 审核状态
     * 0=待审核，1=已通过，2=已拒绝。
     */
    auditStatus: smallint().default(0).notNull(),
    /**
     * 是否隐藏
     */
    isHidden: boolean().default(false).notNull(),
    /**
     * 审核人 ID
     */
    auditById: integer(),
    /**
     * 审核角色
     * 0=版主，1=管理员。
     */
    auditRole: smallint(),
    /**
     * 审核原因
     */
    auditReason: varchar({ length: 500 }),
    /**
     * 审核时间
     */
    auditAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 创建来源
     * 1=管理员创建，2=topic 正文自动创建，3=comment 正文自动创建。
     */
    createSourceType: smallint().notNull(),
    /**
     * 创建该话题资源的用户 ID
     */
    createdByUserId: integer(),
    /**
     * 敏感词命中记录
     */
    sensitiveWordHits: jsonb(),
    /**
     * 可见主题引用数
     */
    topicRefCount: integer().default(0).notNull(),
    /**
     * 可见评论引用数
     */
    commentRefCount: integer().default(0).notNull(),
    /**
     * 关注人数
     */
    followerCount: integer().default(0).notNull(),
    /**
     * 最近一次被引用时间
     */
    lastReferencedAt: timestamp({ withTimezone: true, precision: 6 }),
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
     * 删除时间
     */
    deletedAt: timestamp({ withTimezone: true, precision: 6 }),
  },
  (table) => [
    unique('forum_hashtag_slug_key').on(table.slug),
    index('forum_hashtag_audit_hidden_last_ref_idx').on(
      table.auditStatus,
      table.isHidden,
      table.lastReferencedAt,
    ),
    index('forum_hashtag_follower_last_ref_idx').on(
      table.followerCount,
      table.lastReferencedAt,
    ),
    index('forum_hashtag_created_at_idx').on(table.createdAt),
    index('forum_hashtag_deleted_at_idx').on(table.deletedAt),
    check(
      'forum_hashtag_audit_status_valid_chk',
      sql`${table.auditStatus} in (0, 1, 2)`,
    ),
    check(
      'forum_hashtag_create_source_type_valid_chk',
      sql`${table.createSourceType} in (1, 2, 3)`,
    ),
    check(
      'forum_hashtag_manual_boost_non_negative_chk',
      sql`${table.manualBoost} >= 0`,
    ),
    check(
      'forum_hashtag_topic_ref_count_non_negative_chk',
      sql`${table.topicRefCount} >= 0`,
    ),
    check(
      'forum_hashtag_comment_ref_count_non_negative_chk',
      sql`${table.commentRefCount} >= 0`,
    ),
    check(
      'forum_hashtag_follower_count_non_negative_chk',
      sql`${table.followerCount} >= 0`,
    ),
  ],
)

export type ForumHashtagSelect = typeof forumHashtag.$inferSelect
export type ForumHashtagInsert = typeof forumHashtag.$inferInsert
