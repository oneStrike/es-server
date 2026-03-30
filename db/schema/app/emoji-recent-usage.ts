import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * 最近使用表情表。
 * - 记录用户在不同场景的最近使用轨迹与累计次数。
 * - 采用 (userId, scene, emojiAssetId) 复合主键做幂等聚合更新。
 */
export const emojiRecentUsage = pgTable(
  'emoji_recent_usage',
  {
    /**
     * 用户 ID。
     * - 对应 app_user.id。
     */
    userId: integer().notNull(),
    /**
     * 业务场景。
     * - 1=chat，2=comment，3=forum。
     */
    scene: smallint().notNull(),
    /**
     * 表情资源 ID。
     * - 对应 emoji_asset.id。
     */
    emojiAssetId: integer().notNull(),
    /**
     * 累计使用次数。
     * - 每次上报命中后原子递增。
     */
    useCount: integer().default(1).notNull(),
    /**
     * 最近一次使用时间（UTC）。
     * - 用于最近使用列表排序。
     */
    lastUsedAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
  },
  (table) => [
    /**
     * 复合主键。
     * - 保证同一用户在同一场景下对同一表情只有一条聚合记录。
     */
    primaryKey({
      columns: [table.userId, table.scene, table.emojiAssetId],
    }),
    /**
     * 组合索引：最近使用列表查询路径（按用户+场景+最近时间）。
     */
    index('emoji_recent_usage_user_id_scene_last_used_at_idx').on(
      table.userId,
      table.scene,
      table.lastUsedAt.desc(),
    ),
    /**
     * 普通索引：按表情资源回查使用关系。
     */
    index('emoji_recent_usage_emoji_asset_id_idx').on(table.emojiAssetId),
    /**
     * 检查约束：scene 仅允许 1/2/3。
     */
    check('emoji_recent_usage_scene_chk', sql`${table.scene} in (1, 2, 3)`),
    /**
     * 检查约束：useCount 不允许负数。
     */
    check('emoji_recent_usage_use_count_chk', sql`${table.useCount} >= 0`),
  ],
)

export type EmojiRecentUsageSelect = typeof emojiRecentUsage.$inferSelect
export type EmojiRecentUsageInsert = typeof emojiRecentUsage.$inferInsert
