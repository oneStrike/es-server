/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, pgTable, smallint, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 作品章节表
 * 存储漫画/小说章节信息与统计数据
 */
export const workChapter = pgTable("work_chapter", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 作品ID
   */
  workId: integer().notNull(),
  /**
   * 作品类型
   */
  workType: smallint().notNull(),
  /**
   * 章节标题
   */
  title: varchar({ length: 100 }).notNull(),
  /**
   * 章节副标题
   */
  subtitle: varchar({ length: 200 }),
  /**
   * 章节封面
   */
  cover: varchar({ length: 500 }),
  /**
   * 章节简介
   */
  description: varchar({ length: 1000 }),
  /**
   * 排序值
   */
  sortOrder: integer().default(0).notNull(),
  /**
   * 是否发布
   */
  isPublished: boolean().default(false).notNull(),
  /**
   * 是否预览章节
   */
  isPreview: boolean().default(false).notNull(),
  /**
   * 发布时间
   */
  publishAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 阅读规则
   */
  viewRule: smallint().default(-1).notNull(),
  /**
   * 阅读等级限制ID
   */
  requiredViewLevelId: integer("required_read_level_id"),
  /**
   * 章节价格
   */
  price: integer().default(0).notNull(),
  /**
   * 是否可下载
   */
  canDownload: boolean().default(true).notNull(),
  /**
   * 是否可评论
   */
  canComment: boolean().default(true).notNull(),
  /**
   * 章节内容
   */
  content: text(),
  /**
   * 字数
   */
  wordCount: integer().default(0).notNull(),
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
   * 购买数
   */
  purchaseCount: integer().default(0).notNull(),
  /**
   * 下载数
   */
  downloadCount: integer().default(0).notNull(),
  /**
   * 备注
   */
  remark: varchar({ length: 1000 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 删除时间
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
    /**
     * 唯一索引: workId, sortOrder
     */
    unique("work_chapter_work_id_sort_order_key").on(table.workId, table.sortOrder),
    /**
     * 索引: workId
     */
    index("work_chapter_work_id_idx").on(table.workId),
    /**
     * 索引: workId, sortOrder
     */
    index("work_chapter_work_id_sort_order_idx").on(table.workId, table.sortOrder),
    /**
     * 索引: isPublished, publishAt
     */
    index("work_chapter_is_published_publish_at_idx").on(table.isPublished, table.publishAt),
    /**
     * 索引: viewRule
     */
    index("work_chapter_view_rule_idx").on(table.viewRule),
    /**
     * 索引: isPreview
     */
    index("work_chapter_is_preview_idx").on(table.isPreview),
    /**
     * 索引: viewCount
     */
    index("work_chapter_view_count_idx").on(table.viewCount),
    /**
     * 索引: likeCount
     */
    index("work_chapter_like_count_idx").on(table.likeCount),
    /**
     * 索引: createdAt
     */
    index("work_chapter_created_at_idx").on(table.createdAt),
    /**
     * 索引: publishAt
     */
    index("work_chapter_publish_at_idx").on(table.publishAt),
    /**
     * 索引: requiredViewLevelId
     */
    index("work_chapter_required_read_level_id_idx").on(table.requiredViewLevelId),
    /**
     * 索引: workType
     */
    index("work_chapter_work_type_idx").on(table.workType),
]);
