import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * App 更新商店地址 JSON 结构。
 * 只保留稳定渠道编码和地址，展示名称统一由系统字典派生。
 */
export interface AppUpdateStoreLinkValue {
  /**
   * 渠道编码。
   */
  channelCode: string
  /**
   * 商店地址。
   */
  storeUrl: string
}

/**
 * App 更新发布表。
 * 每个平台维护多条历史版本，只有一条可处于发布态。
 */
export const appUpdateRelease = pgTable(
  'app_update_release',
  {
    /**
     * 主键 ID。
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 发布平台。
     * 当前仅支持 ios / android。
     */
    platform: varchar({ length: 20 }).notNull(),
    /**
     * 展示版本号。
     * 用于后台管理与客户端提示。
     */
    versionName: varchar({ length: 50 }).notNull(),
    /**
     * 内部构建号。
     * 用于客户端更新比较，必须为正整数。
     */
    buildCode: integer().notNull(),
    /**
     * 更新说明。
     */
    releaseNotes: varchar({ length: 5000 }),
    /**
     * 是否强制更新。
     */
    forceUpdate: boolean().default(false).notNull(),
    /**
     * 安装包来源类型。
     * upload=后台上传，url=外部地址。
     */
    packageSourceType: varchar({ length: 20 }),
    /**
     * 安装包地址。
     * upload 模式下可为本地 `/files/...` 或 CDN 绝对地址。
     */
    packageUrl: varchar({ length: 1000 }),
    /**
     * 上传安装包原始文件名。
     */
    packageOriginalName: varchar({ length: 255 }),
    /**
     * 上传安装包大小（字节）。
     */
    packageFileSize: integer(),
    /**
     * 上传安装包 MIME 类型。
     */
    packageMimeType: varchar({ length: 100 }),
    /**
     * 自定义下载页地址。
     */
    customDownloadUrl: varchar({ length: 1000 }),
    /**
     * 商店地址列表。
     * 仅持久化渠道编码和商店地址，渠道名称由字典项动态回填。
     */
    storeLinks: jsonb()
      .$type<AppUpdateStoreLinkValue[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    /**
     * 是否已发布。
     */
    isPublished: boolean().default(false).notNull(),
    /**
     * 发布时间。
     */
    publishedAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 创建人 ID。
     */
    createdById: integer(),
    /**
     * 更新人 ID。
     */
    updatedById: integer(),
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
  (table) => [
    /**
     * 同平台构建号唯一。
     */
    unique('app_update_release_platform_build_code_key').on(
      table.platform,
      table.buildCode,
    ),
    /**
     * 平台发布状态与构建号索引。
     */
    index('app_update_release_platform_is_published_build_code_idx').on(
      table.platform,
      table.isPublished,
      table.buildCode,
    ),
    /**
     * 发布时间索引。
     */
    index('app_update_release_published_at_idx').on(table.publishedAt),
    /**
     * 构建号必须为正整数。
     */
    check(
      'app_update_release_build_code_positive_chk',
      sql`${table.buildCode} > 0`,
    ),
  ],
)

export type AppUpdateReleaseSelect = typeof appUpdateRelease.$inferSelect
export type AppUpdateReleaseInsert = typeof appUpdateRelease.$inferInsert
