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
 * 表情包主表。
 * - 管理表情包基础信息、展示排序与可见场景。
 * - sceneType 使用 smallint[] 存储支持场景集合，当前取值：1(chat)/2(comment)/3(forum)。
 */
export const emojiPack = snakeCase.table(
  'emoji_pack',
  {
    /**
     * 主键 ID（自增）。
     * - 作为表情包的唯一标识。
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 表情包业务编码。
     * - 用于程序内稳定引用，要求全局唯一。
     * - 典型值：default、animals、meme。
     */
    code: varchar({ length: 64 }).notNull(),
    /**
     * 表情包名称。
     * - 用于管理端与客户端展示。
     */
    name: varchar({ length: 100 }).notNull(),
    /**
     * 表情包描述。
     * - 可选字段，用于补充包的来源、用途或说明信息。
     */
    description: varchar({ length: 500 }),
    /**
     * 表情包图标 URL。
     * - 在客户端选择器中展示分组图标。
     */
    iconUrl: varchar({ length: 500 }),
    /**
     * 排序值。
     * - 值越小越靠前。
     * - 同值时以 id 作为次序兜底。
     */
    sortOrder: integer().default(0).notNull(),
    /**
     * 启用状态。
     * - false 时该表情包整体不可用。
     */
    isEnabled: boolean().default(true).notNull(),
    /**
     * 是否在选择器可见。
     * - false 时允许业务侧保留数据，但不在常规选择器展示。
     */
    visibleInPicker: boolean().default(true).notNull(),
    /**
     * 场景集合。
     * - 使用 smallint[] 存储生效场景。
     * - 1=聊天，2=评论，3=论坛。
     * - 默认对聊天、评论、论坛全场景可见。
     */
    sceneType: smallint()
      .array()
      .default(sql`ARRAY[1,2,3]::smallint[]`)
      .notNull(),
    /**
     * 创建人后台用户 ID。
     * - 为空表示历史数据或未记录来源。
     */
    createdById: integer(),
    /**
     * 最后更新人后台用户 ID。
     * - 为空表示历史数据或未记录来源。
     */
    updatedById: integer(),
    /**
     * 创建时间（UTC）。
     * - 默认写入当前数据库时间。
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /**
     * 更新时间（UTC）。
     * - 每次更新记录时自动刷新。
     */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
    /**
     * 软删除时间（UTC）。
     * - 非空表示该记录已逻辑删除。
     */
    deletedAt: timestamp({ withTimezone: true, precision: 6 }),
  },
  (table) => [
    /**
     * 唯一约束：业务编码唯一。
     */
    unique('emoji_pack_code_key').on(table.code),
    /**
     * 普通索引：按启用状态筛选。
     */
    index('emoji_pack_is_enabled_idx').on(table.isEnabled),
    /**
     * 普通索引：支持排序场景的顺序读取。
     */
    index('emoji_pack_sort_order_idx').on(table.sortOrder),
    /**
     * 普通索引：支持软删除数据过滤。
     */
    index('emoji_pack_deleted_at_idx').on(table.deletedAt),
    /**
     * GIN 索引：支持 sceneType 数组包含查询（@>）。
     */
    index('emoji_pack_scene_type_idx').using('gin', table.sceneType),
    /**
     * 组合索引：启用 + 未删除过滤常用路径。
     */
    index('emoji_pack_is_enabled_deleted_at_idx').on(
      table.isEnabled,
      table.deletedAt,
    ),
    /**
     * 组合索引：启用 + 未删除 + 排序列表常用路径。
     */
    index('emoji_pack_is_enabled_deleted_at_sort_order_idx').on(
      table.isEnabled,
      table.deletedAt,
      table.sortOrder,
    ),
    /**
     * 检查约束：sceneType 中仅允许 1/2/3 三个场景值。
     */
    check(
      'emoji_pack_scene_type_valid_chk',
      sql`${table.sceneType} <@ ARRAY[1,2,3]::smallint[]`,
    ),
    /**
     * 检查约束：sceneType 不能为空数组，至少包含一个场景。
     */
    check(
      'emoji_pack_scene_type_non_empty_chk',
      sql`cardinality(${table.sceneType}) > 0`,
    ),
  ],
)

export type EmojiPackSelect = typeof emojiPack.$inferSelect
export type EmojiPackInsert = typeof emojiPack.$inferInsert
