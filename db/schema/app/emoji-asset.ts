import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 表情资源表。
 * - 存储每一个可渲染表情条目（unicode/custom）。
 * - 通过 packId 归属到具体表情包。
 */
export const emojiAsset = pgTable(
  'emoji_asset',
  {
    /**
     * 主键 ID（自增）。
     * - 作为表情资源的唯一标识。
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 所属表情包 ID。
     * - 关联 emoji_pack.id。
     */
    packId: integer().notNull(),
    /**
     * 资源类型。
     * - 1=unicode（系统字符）
     * - 2=custom（自定义图片）
     */
    kind: smallint().notNull(),
    /**
     * 短码。
     * - custom 表情必填。
     * - 用于 `:smile:` 这类解析与检索。
     */
    shortcode: varchar({ length: 32 }),
    /**
     * Unicode 序列。
     * - unicode 表情必填。
     * - 例如 😀 或组合序列。
     */
    unicodeSequence: varchar({ length: 191 }),
    /**
     * 主资源 URL。
     * - custom 表情必填。
     * - 可指向 gif/webp/png 等可展示资源。
     */
    imageUrl: varchar({ length: 500 }),
    /**
     * 静态资源 URL。
     * - 可选字段，常用于动图降级静态图。
     */
    staticUrl: varchar({ length: 500 }),
    /**
     * 是否为动图。
     * - 用于客户端播放策略与渲染逻辑判断。
     */
    isAnimated: boolean().default(false).notNull(),
    /**
     * 分类标签。
     * - 用于筛选、分组展示（如 people/animals）。
     */
    category: varchar({ length: 32 }),
    /**
     * 多语言关键词 JSON。
     * - 典型结构：{"zh-CN":["微笑"],"en-US":["smile"]}。
     */
    keywords: jsonb(),
    /**
     * 排序值。
     * - 在同一个表情包内按值升序展示。
     */
    sortOrder: integer().default(0).notNull(),
    /**
     * 启用状态。
     * - false 时该资源不参与目录、搜索与解析。
     */
    isEnabled: boolean().default(true).notNull(),
    /**
     * 创建人后台用户 ID。
     */
    createdById: integer(),
    /**
     * 最后更新人后台用户 ID。
     */
    updatedById: integer(),
    /**
     * 创建时间（UTC）。
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
    /**
     * 更新时间（UTC）。
     * - 每次更新时自动刷新。
     */
    updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
    /**
     * 软删除时间（UTC）。
     */
    deletedAt: timestamp({ withTimezone: true, precision: 6 }),
  },
  (table) => [
    /**
     * 组合索引：按表情包读取并排序。
     */
    index('emoji_asset_pack_id_sort_order_idx').on(
      table.packId,
      table.sortOrder,
    ),
    /**
     * 组合索引：表情包内活跃资源列表读取路径。
     */
    index('emoji_asset_pack_id_is_enabled_deleted_at_sort_order_idx').on(
      table.packId,
      table.isEnabled,
      table.deletedAt,
      table.sortOrder,
    ),
    /**
     * 普通索引：按资源类型过滤。
     */
    index('emoji_asset_kind_idx').on(table.kind),
    /**
     * 普通索引：按分类过滤。
     */
    index('emoji_asset_category_idx').on(table.category),
    /**
     * 普通索引：软删除过滤。
     */
    index('emoji_asset_deleted_at_idx').on(table.deletedAt),
    /**
     * 条件唯一索引：仅对未删除数据约束 shortcode 唯一。
     * - 允许历史软删除记录保留旧 shortcode。
     */
    uniqueIndex('emoji_asset_shortcode_live_key')
      .on(table.shortcode)
      .where(sql`${table.shortcode} is not null and ${table.deletedAt} is null`),
    /**
     * 检查约束：kind 仅允许 1/2。
     */
    check('emoji_asset_kind_chk', sql`${table.kind} in (1, 2)`),
    /**
     * 检查约束：当 kind=unicode 时必须提供 unicodeSequence。
     */
    check(
      'emoji_asset_kind_unicode_required_chk',
      sql`(${table.kind} <> 1) or (${table.unicodeSequence} is not null)`,
    ),
    /**
     * 检查约束：当 kind=custom 时必须提供 shortcode + imageUrl。
     */
    check(
      'emoji_asset_kind_custom_required_chk',
      sql`(${table.kind} <> 2) or (${table.shortcode} is not null and ${table.imageUrl} is not null)`,
    ),
    /**
     * 检查约束：shortcode 仅允许小写字母/数字/下划线，长度 2-32。
     * - 约束保证解析器、搜索和跨端序列化行为稳定。
     */
    check(
      'emoji_asset_shortcode_format_chk',
      sql`${table.shortcode} is null or ${table.shortcode} ~ '^[a-z0-9_]{2,32}$'`,
    ),
  ],
)

export type EmojiAssetSelect = typeof emojiAsset.$inferSelect
export type EmojiAssetInsert = typeof emojiAsset.$inferInsert
