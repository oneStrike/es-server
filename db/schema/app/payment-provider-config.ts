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
 * 支付 provider 配置表。
 * 单客户独立部署内按渠道、场景、端、应用和环境确定性选择配置。
 */
export const paymentProviderConfig = snakeCase.table(
  'payment_provider_config',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 支付渠道（1=支付宝；2=微信）。 */
    channel: smallint().notNull(),
    /** 支付场景（1=App；2=H5；3=小程序）。 */
    paymentScene: smallint().notNull(),
    /** 客户端平台（1=Android；2=iOS；3=HarmonyOS；4=Web；5=小程序）。 */
    platform: smallint().notNull(),
    /** 运行环境（1=沙箱；2=正式）。 */
    environment: smallint().notNull(),
    /** 客户端应用键，同一部署内区分多应用。 */
    clientAppKey: varchar({ length: 80 }).default('').notNull(),
    /** 配置名称，供 admin 识别。 */
    configName: varchar({ length: 120 }).default('').notNull(),
    /** provider 应用 ID，空字符串表示该维度不参与选择。 */
    appId: varchar({ length: 120 }).default('').notNull(),
    /** provider 商户 ID，空字符串表示该维度不参与选择。 */
    mchId: varchar({ length: 120 }).default('').notNull(),
    /** 通知回调地址。 */
    notifyUrl: varchar({ length: 500 }),
    /** H5 返回地址。 */
    returnUrl: varchar({ length: 500 }),
    /** 自动续费签约通知地址。 */
    agreementNotifyUrl: varchar({ length: 500 }),
    /** H5 允许返回域名列表。 */
    allowedReturnDomains: jsonb(),
    /** 证书模式（1=普通密钥；2=证书模式）。 */
    certMode: smallint().default(1).notNull(),
    /** 支付宝公钥引用。 */
    publicKeyRef: varchar({ length: 160 }),
    /** 应用私钥引用。 */
    privateKeyRef: varchar({ length: 160 }),
    /** 微信 APIv3 key 引用。 */
    apiV3KeyRef: varchar('api_v3_key_ref', { length: 160 }),
    /** 应用证书引用。 */
    appCertRef: varchar({ length: 160 }),
    /** 平台证书引用。 */
    platformCertRef: varchar({ length: 160 }),
    /** 根证书引用。 */
    rootCertRef: varchar({ length: 160 }),
    /** 配置版本，配置更新时单调递增。 */
    configVersion: integer().default(1).notNull(),
    /** 密钥版本引用，不存明文密钥。 */
    credentialVersionRef: varchar({ length: 160 }).notNull(),
    /** 配置摘要快照，存放证书指纹、域名约束等非明文信息。 */
    configMetadata: jsonb(),
    /** 是否支持自动续费签约。 */
    supportsAutoRenew: boolean().default(false).notNull(),
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
    uniqueIndex('payment_provider_config_enabled_unique_idx')
      .on(
        table.channel,
        table.paymentScene,
        table.platform,
        table.clientAppKey,
        table.appId,
        table.mchId,
        table.environment,
      )
      .where(sql`${table.isEnabled} = true`),
    index('payment_provider_config_selection_idx').on(
      table.channel,
      table.paymentScene,
      table.platform,
      table.clientAppKey,
      table.environment,
      table.isEnabled,
      table.sortOrder,
    ),
    check(
      'payment_provider_config_channel_valid_chk',
      sql`${table.channel} in (1, 2)`,
    ),
    check(
      'payment_provider_config_scene_valid_chk',
      sql`${table.paymentScene} in (1, 2, 3)`,
    ),
    check(
      'payment_provider_config_platform_valid_chk',
      sql`${table.platform} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'payment_provider_config_environment_valid_chk',
      sql`${table.environment} in (1, 2)`,
    ),
    check(
      'payment_provider_config_cert_mode_valid_chk',
      sql`${table.certMode} in (1, 2)`,
    ),
    check(
      'payment_provider_config_version_positive_chk',
      sql`${table.configVersion} > 0`,
    ),
  ],
)

export type PaymentProviderConfigSelect =
  typeof paymentProviderConfig.$inferSelect
export type PaymentProviderConfigInsert =
  typeof paymentProviderConfig.$inferInsert
