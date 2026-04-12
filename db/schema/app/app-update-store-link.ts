import {
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * App 更新商店地址表。
 * 每条发布记录可以绑定多个渠道商店地址。
 */
export const appUpdateStoreLink = pgTable(
  'app_update_store_link',
  {
    /**
     * 主键 ID。
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 关联发布记录 ID。
     */
    releaseId: integer().notNull(),
    /**
     * 渠道编码。
     * `default` 作为默认兜底渠道。
     */
    channelCode: varchar({ length: 50 }).notNull(),
    /**
     * 渠道名称。
     */
    channelName: varchar({ length: 50 }).notNull(),
    /**
     * 商店地址。
     */
    storeUrl: varchar({ length: 1000 }).notNull(),
    /**
     * 创建时间。
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /**
     * 更新时间。
     */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    /**
     * 单个发布下的渠道编码唯一。
     */
    unique('app_update_store_link_release_id_channel_code_key').on(
      table.releaseId,
      table.channelCode,
    ),
    /**
     * 发布 ID 索引。
     */
    index('app_update_store_link_release_id_idx').on(table.releaseId),
  ],
)

export type AppUpdateStoreLinkSelect = typeof appUpdateStoreLink.$inferSelect
export type AppUpdateStoreLinkInsert = typeof appUpdateStoreLink.$inferInsert
