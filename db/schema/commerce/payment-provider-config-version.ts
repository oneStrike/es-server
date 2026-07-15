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
 * 支付 provider 配置不可变版本表。
 * 每次运营更新配置都会产生新版本，历史订单按下单时版本验签。
 */
export const paymentProviderConfigVersion = snakeCase.table(
  'payment_provider_config_version',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 支付 provider 配置 ID。 */
    providerConfigId: integer().notNull(),
    /** 单配置内单调递增版本号。 */
    configVersion: integer().notNull(),
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
    /** 配置名称快照。 */
    configName: varchar({ length: 120 }).default('').notNull(),
    /** provider 应用 ID 快照。 */
    appId: varchar({ length: 120 }).default('').notNull(),
    /** provider 商户 ID 快照。 */
    mchId: varchar({ length: 120 }).default('').notNull(),
    /** 通知回调地址快照。 */
    notifyUrl: varchar({ length: 500 }),
    /** H5 返回地址快照。 */
    returnUrl: varchar({ length: 500 }),
    /** H5 允许返回域名列表快照。 */
    allowedReturnDomains: jsonb(),
    /** 证书模式（1=普通密钥；2=证书模式）。 */
    certMode: smallint().default(1).notNull(),
    /** 应用私钥凭据 ID。 */
    appPrivateCredentialId: integer(),
    /** 支付宝公钥凭据 ID。 */
    alipayPublicCredentialId: integer(),
    /** 微信 APIv3 key 凭据 ID。 */
    wechatApiV3CredentialId: integer('wechat_api_v3_credential_id'),
    /** 应用证书 ID。 */
    appCertificateId: integer(),
    /** 平台证书 ID。 */
    platformCertificateId: integer(),
    /** 根证书 ID。 */
    rootCertificateId: integer(),
    /** 版本证书引用摘要，不包含证书或密钥明文。 */
    credentialSnapshot: jsonb(),
    /** 配置摘要快照，不包含明文密钥。 */
    configSnapshot: jsonb(),
    /** 版本状态（1=启用；2=禁用；3=已轮换）。 */
    status: smallint().default(1).notNull(),
    /** 是否可被新订单选择。 */
    isActive: boolean().default(true).notNull(),
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
    uniqueIndex('payment_provider_config_version_key').on(
      table.providerConfigId,
      table.configVersion,
    ),
    index('payment_provider_config_version_active_idx').on(
      table.providerConfigId,
      table.isActive,
      table.configVersion,
    ),
    index('payment_provider_config_version_selection_idx').on(
      table.channel,
      table.paymentScene,
      table.platform,
      table.clientAppKey,
      table.environment,
      table.status,
      table.isActive,
    ),
    check(
      'payment_provider_config_version_number_positive_chk',
      sql`${table.configVersion} > 0`,
    ),
    check(
      'payment_provider_config_version_channel_valid_chk',
      sql`${table.channel} in (1, 2)`,
    ),
    check(
      'payment_provider_config_version_scene_valid_chk',
      sql`${table.paymentScene} in (1, 2, 3)`,
    ),
    check(
      'payment_provider_config_version_platform_valid_chk',
      sql`${table.platform} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'payment_provider_config_version_environment_valid_chk',
      sql`${table.environment} in (1, 2)`,
    ),
    check(
      'payment_provider_config_version_cert_mode_valid_chk',
      sql`${table.certMode} in (1, 2)`,
    ),
    check(
      'payment_provider_config_version_status_valid_chk',
      sql`${table.status} in (1, 2, 3)`,
    ),
  ],
)

export type PaymentProviderConfigVersionSelect =
  typeof paymentProviderConfigVersion.$inferSelect
export type PaymentProviderConfigVersionInsert =
  typeof paymentProviderConfigVersion.$inferInsert
