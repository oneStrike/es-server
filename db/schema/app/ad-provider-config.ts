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
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 广告 provider 配置表。
 * 支持穿山甲和腾讯优量汇广告位的 admin 自配置。
 */
export const adProviderConfig = snakeCase.table(
  'ad_provider_config',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 广告 provider（1=穿山甲；2=腾讯优量汇）。 */
    provider: smallint().notNull(),
    /** 客户端平台（1=Android；2=iOS；3=HarmonyOS；4=Web；5=小程序）。 */
    platform: smallint().notNull(),
    /** 运行环境（1=沙箱；2=正式）。 */
    environment: smallint().notNull(),
    /** 客户端应用键，同一部署内区分多应用。 */
    clientAppKey: varchar({ length: 80 }).default('').notNull(),
    /** provider 应用 ID。 */
    appId: varchar({ length: 120 }).default('').notNull(),
    /** 广告位 key。 */
    placementKey: varchar({ length: 120 }).notNull(),
    /** 目标范围（1=低价章节；2=新用户冷启动；3=运营白名单）。 */
    targetScope: smallint().notNull(),
    /** 每日次数上限，0=不限制。 */
    dailyLimit: smallint().default(0).notNull(),
    /** 配置版本，配置更新时单调递增。 */
    configVersion: integer().default(1).notNull(),
    /** SSV 密钥版本引用，不存明文密钥。 */
    credentialVersionRef: varchar({ length: 160 }).notNull(),
    /** 回调地址。 */
    callbackUrl: varchar({ length: 500 }),
    /** 配置摘要快照，存放安全指纹等非明文信息。 */
    configMetadata: jsonb(),
    /** 排序值，0=默认排序。 */
    sortOrder: smallint().default(0).notNull(),
    /** 是否启用。 */
    isEnabled: boolean().default(true).notNull(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('ad_provider_config_enabled_unique_idx')
      .on(
        table.provider,
        table.platform,
        table.clientAppKey,
        table.appId,
        table.placementKey,
        table.environment,
      )
      .where(sql`${table.isEnabled} = true`),
    index('ad_provider_config_selection_idx').on(
      table.provider,
      table.platform,
      table.clientAppKey,
      table.appId,
      table.placementKey,
      table.environment,
      table.isEnabled,
    ),
    check(
      'ad_provider_config_provider_valid_chk',
      sql`${table.provider} in (1, 2)`,
    ),
    check(
      'ad_provider_config_platform_valid_chk',
      sql`${table.platform} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'ad_provider_config_environment_valid_chk',
      sql`${table.environment} in (1, 2)`,
    ),
    check(
      'ad_provider_config_target_scope_valid_chk',
      sql`${table.targetScope} in (1, 2, 3)`,
    ),
    check('ad_provider_config_daily_limit_chk', sql`${table.dailyLimit} >= 0`),
  ],
)

export type AdProviderConfigSelect = typeof adProviderConfig.$inferSelect
export type AdProviderConfigInsert = typeof adProviderConfig.$inferInsert
