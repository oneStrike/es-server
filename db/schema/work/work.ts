/**
 * Auto-converted from legacy schema.
 */

import { boolean, date, doublePrecision, index, integer, pgTable, smallint, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 作品表
 * 统一存储漫画与小说的基础信息
 */
export const work = pgTable("work", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 作品类型 (1=漫画, 2 =小说)
   */
  type: smallint().notNull(),
  /**
   * 作品名称
   */
  name: varchar({ length: 100 }).notNull(),
  /**
   * 别名
   */
  alias: varchar({ length: 200 }),
  /**
   * 封面
   */
  cover: varchar({ length: 500 }).notNull(),
  /**
   * 简介
   */
  description: text().notNull(),
  /**
   * 语言
   */
  language: varchar({ length: 10 }).notNull(),
  /**
   * 地区
   */
  region: varchar({ length: 10 }).notNull(),
  /**
   * 年龄分级
   */
  ageRating: varchar("ageRating", { length: 10 }),
  /**
   * 连载状态
   */
  serialStatus: smallint("serialStatus").default(0).notNull(),
  /**
   * 出版方
   */
  publisher: varchar({ length: 100 }),
  /**
   * 原作来源
   */
  originalSource: varchar("originalSource", { length: 100 }),
  /**
   * 版权信息
   */
  copyright: varchar({ length: 500 }),
  /**
   * 免责声明
   */
  disclaimer: text(),
  /**
   * 备注
   */
  remark: varchar({ length: 1000 }),
  /**
   * 是否发布
   */
  isPublished: boolean("isPublished").default(true).notNull(),
  /**
   * 是否推荐
   */
  isRecommended: boolean("isRecommended").default(false).notNull(),
  /**
   * 是否热门
   */
  isHot: boolean("isHot").default(false).notNull(),
  /**
   * 是否最新
   */
  isNew: boolean("isNew").default(false).notNull(),
  /**
   * 发布日期
   */
  publishAt: date("publishAt"),
  /**
   * 最近更新时间
   */
  lastUpdated: timestamp("lastUpdated", { withTimezone: true, precision: 6 }),
  /**
   * 阅读规则
   */
  viewRule: smallint().default(0).notNull(),
  /**
   * 阅读等级限制ID
   */
  requiredViewLevelId: integer(),
  /**
   * 关联论坛板块ID
   */
  forumSectionId: integer("forum_section_id"),
  /**
   * 章节价格
   */
  chapterPrice: integer().default(0).notNull(),
  /**
   * 是否可评论
   */
  canComment: boolean().default(true).notNull(),
  /**
   * 推荐权重
   */
  recommendWeight: doublePrecision("recommendWeight").default(1.0).notNull(),
  /**
   * 浏览数
   */
  viewCount: integer("viewCount").default(0).notNull(),
  /**
   * 收藏数
   */
  favoriteCount: integer("favoriteCount").default(0).notNull(),
  /**
   * 点赞数
   */
  likeCount: integer("likeCount").default(0).notNull(),
  /**
   * 评论数
   */
  commentCount: integer().default(0).notNull(),
  /**
   * 下载数
   */
  downloadCount: integer("downloadCount").default(0).notNull(),
  /**
   * 评分
   */
  rating: doublePrecision(),
  /**
   * 评分人数
   */
  ratingCount: integer("ratingCount").default(0).notNull(),
  /**
   * 热度值
   */
  popularity: integer().default(0).notNull(),
  /**
   * 创建时间
   */
  createdAt: timestamp("createdAt", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 删除时间
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
    /**
     * 索引: isPublished, publishAt
     */
    index("work_isPublished_publishAt_idx").on(table.isPublished, table.publishAt),
    /**
     * 索引: popularity
     */
    index("work_popularity_idx").on(table.popularity),
    /**
     * 索引: language, region
     */
    index("work_language_region_idx").on(table.language, table.region),
    /**
     * 索引: serialStatus
     */
    index("work_serialStatus_idx").on(table.serialStatus),
    /**
     * 索引: lastUpdated
     */
    index("work_lastUpdated_idx").on(table.lastUpdated),
    /**
     * 索引: name
     */
    index("work_name_idx").on(table.name),
    /**
     * 索引: isRecommended
     */
    index("work_isRecommended_idx").on(table.isRecommended),
    /**
     * 索引: isHot, isNew
     */
    index("work_isHot_isNew_idx").on(table.isHot, table.isNew),
    /**
     * 索引: type
     */
    index("work_type_idx").on(table.type),
    /**
     * 索引: viewRule
     */
    index("work_view_rule_idx").on(table.viewRule),
    /**
     * 索引: requiredViewLevelId
     */
    index("work_required_view_level_id_idx").on(table.requiredViewLevelId),
    /**
     * 索引: forumSectionId
     */
    index("work_forum_section_id_idx").on(table.forumSectionId),
    /**
     * 唯一约束: forumSectionId
     */
    unique("work_forum_section_id_key").on(table.forumSectionId),
    /**
     * 索引: commentCount
     */
    index("work_comment_count_idx").on(table.commentCount),
    /**
     * 索引: deletedAt
     */
    index("work_deleted_at_idx").on(table.deletedAt),
]);

export type Work = typeof work.$inferSelect;
export type WorkInsert = typeof work.$inferInsert;
