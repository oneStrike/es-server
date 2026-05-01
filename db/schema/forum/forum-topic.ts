/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 论坛主题表
 */
export const forumTopic = snakeCase.table(
  'forum_topic',
  {
    /**
     * 主键ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 版块ID
     */
    sectionId: integer().notNull(),
    /**
     * 发帖用户ID
     */
    userId: integer().notNull(),
    /**
     * 最后评论用户ID
     */
    lastCommentUserId: integer(),
    /**
     * 审核人ID
     */
    auditById: integer(),
    /**
     * 标题
     */
    title: varchar({ length: 200 }).notNull(),
    /**
     * 正文 HTML。
     * 对外唯一正文表示，纯文本编辑器也需输出最小 HTML。
     */
    html: text().notNull(),
    /**
     * 正文纯文本派生列。
     * 供搜索、摘要、审核与摘录链路复用，不再表示客户端原始输入。
     */
    content: text().notNull(),
    /**
     * canonical 正文文档。
     * 主题正文的唯一真相源；运行时不再依赖原始 content 作为输入来源。
     */
    body: jsonb().notNull(),
    /**
     * 正文版本。
     * 1=当前 canonical body v1
     */
    bodyVersion: smallint().default(1).notNull(),
    /**
     * 图片列表
     */
    images: varchar({ length: 500 })
      .array()
      .default(sql`ARRAY[]::varchar[]`)
      .notNull(),
    /**
     * 视频列表
     */
    videos: jsonb()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    /**
     * 是否置顶
     */
    isPinned: boolean().default(false).notNull(),
    /**
     * 是否精选
     */
    isFeatured: boolean().default(false).notNull(),
    /**
     * 是否锁定
     */
    isLocked: boolean().default(false).notNull(),
    /**
     * 是否隐藏
     */
    isHidden: boolean().default(false).notNull(),
    /**
     * 审核状态（0=待审核，1=已通过，2=已拒绝）
     */
    auditStatus: smallint().default(1).notNull(),
    /**
     * 审核角色（0=版主，1=管理员）
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
     * 乐观锁版本号
     */
    version: integer().default(0).notNull(),
    /**
     * 敏感词命中记录
     */
    sensitiveWordHits: jsonb(),
    /**
     * 发帖时解析到的国家/地区
     * 仅记录新写入主题的属地快照，无法解析或历史记录时为空
     */
    geoCountry: varchar({ length: 100 }),
    /**
     * 发帖时解析到的省份/州
     * 仅记录新写入主题的属地快照，无法解析或历史记录时为空
     */
    geoProvince: varchar({ length: 100 }),
    /**
     * 发帖时解析到的城市
     * 仅记录新写入主题的属地快照，无法解析或历史记录时为空
     */
    geoCity: varchar({ length: 100 }),
    /**
     * 发帖时解析到的网络运营商
     * 仅记录新写入主题的属地快照，无法解析或历史记录时为空
     */
    geoIsp: varchar({ length: 100 }),
    /**
     * 属地解析来源
     * 当前固定为 ip2region；历史记录或未补齐属地快照时为空
     */
    geoSource: varchar({ length: 50 }),
    /**
     * 浏览数
     */
    viewCount: integer().default(0).notNull(),
    /**
     * 点赞数
     */
    likeCount: integer().default(0).notNull(),
    /**
     * 评论数
     */
    commentCount: integer().default(0).notNull(),
    /**
     * 收藏数
     */
    favoriteCount: integer().default(0).notNull(),
    /**
     * 最后评论时间
     */
    lastCommentAt: timestamp({ withTimezone: true, precision: 6 }),
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
    /**
     * 索引: sectionId
     */
    index('forum_topic_section_id_idx').on(table.sectionId),
    /**
     * 索引: userId
     */
    index('forum_topic_user_id_idx').on(table.userId),
    /**
     * 索引: userId, createdAt（仅未删除主题）
     */
    index('forum_topic_user_id_created_at_live_idx')
      .on(table.userId, table.createdAt.desc())
      .where(sql`${table.deletedAt} is null`),
    /**
     * 索引: userId, sectionId, createdAt（仅未删除主题）
     */
    index('forum_topic_user_id_section_id_created_at_live_idx')
      .on(table.userId, table.sectionId, table.createdAt.desc())
      .where(sql`${table.deletedAt} is null`),
    /**
     * 索引: isPinned, createdAt
     */
    index('forum_topic_is_pinned_created_at_idx').on(
      table.isPinned,
      table.createdAt,
    ),
    /**
     * 索引: isFeatured, createdAt
     */
    index('forum_topic_is_featured_created_at_idx').on(
      table.isFeatured,
      table.createdAt,
    ),
    /**
     * 索引: isLocked
     */
    index('forum_topic_is_locked_idx').on(table.isLocked),
    /**
     * 索引: isHidden
     */
    index('forum_topic_is_hidden_idx').on(table.isHidden),
    /**
     * 索引: auditStatus
     */
    index('forum_topic_audit_status_idx').on(table.auditStatus),
    /**
     * 索引: viewCount
     */
    index('forum_topic_view_count_idx').on(table.viewCount),
    /**
     * 索引: likeCount
     */
    index('forum_topic_like_count_idx').on(table.likeCount),
    /**
     * 索引: commentCount
     */
    index('forum_topic_comment_count_idx').on(table.commentCount),
    /**
     * 索引: favoriteCount
     */
    index('forum_topic_favorite_count_idx').on(table.favoriteCount),
    /**
     * 计数字段非负约束
     */
    check(
      'forum_topic_view_count_non_negative_chk',
      sql`${table.viewCount} >= 0`,
    ),
    check(
      'forum_topic_like_count_non_negative_chk',
      sql`${table.likeCount} >= 0`,
    ),
    check(
      'forum_topic_comment_count_non_negative_chk',
      sql`${table.commentCount} >= 0`,
    ),
    check(
      'forum_topic_favorite_count_non_negative_chk',
      sql`${table.favoriteCount} >= 0`,
    ),
    /**
     * 正文版本闭集约束
     */
    check(
      'forum_topic_body_version_valid_chk',
      sql`${table.bodyVersion} in (1)`,
    ),
    /**
     * 索引: lastCommentAt
     */
    index('forum_topic_last_comment_at_idx').on(table.lastCommentAt),
    /**
     * 索引: createdAt
     */
    index('forum_topic_created_at_idx').on(table.createdAt),
    /**
     * 索引: updatedAt
     */
    index('forum_topic_updated_at_idx').on(table.updatedAt),
    /**
     * 索引: deletedAt
     */
    index('forum_topic_deleted_at_idx').on(table.deletedAt),
    /**
     * 索引: sectionId, isPinned, createdAt
     */
    index('forum_topic_section_id_is_pinned_created_at_idx').on(
      table.sectionId,
      table.isPinned,
      table.createdAt,
    ),
    /**
     * 索引: sectionId, isFeatured, createdAt
     */
    index('forum_topic_section_id_is_featured_created_at_idx').on(
      table.sectionId,
      table.isFeatured,
      table.createdAt,
    ),
    /**
     * 索引: sectionId, lastCommentAt
     */
    index('forum_topic_section_id_last_comment_at_idx').on(
      table.sectionId,
      table.lastCommentAt,
    ),
  ],
)

export type ForumTopicSelect = typeof forumTopic.$inferSelect
export type ForumTopicInsert = typeof forumTopic.$inferInsert
