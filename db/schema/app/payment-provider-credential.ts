import { sql } from 'drizzle-orm'
import {
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
 * 支付 provider 凭据注册表。
 * 只保存外部密钥引用和运营可读元数据，不保存明文密钥。
 */
export const paymentProviderCredential = snakeCase.table(
  'payment_provider_credential',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 支付渠道（1=支付宝；2=微信）。 */
    channel: smallint().notNull(),
    /** 凭据用途（1=应用私钥；2=支付宝公钥；3=微信 APIv3 key；4=商户私钥）。 */
    credentialType: smallint().notNull(),
    /** 外部 secret/KMS 引用。 */
    credentialRef: varchar({ length: 180 }).notNull(),
    /** 凭据版本标签。 */
    versionLabel: varchar({ length: 80 }).default('').notNull(),
    /** 运营展示名称。 */
    displayName: varchar({ length: 160 }).default('').notNull(),
    /** 掩码标识，禁止存放明文密钥。 */
    maskedIdentifier: varchar({ length: 160 }).default('').notNull(),
    /** 指纹或摘要，用于核对轮换。 */
    fingerprint: varchar({ length: 160 }).default('').notNull(),
    /** 凭据状态（1=启用；2=禁用；3=过期）。 */
    status: smallint().default(1).notNull(),
    /** 过期时间。 */
    expiredAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 运营备注和非敏感扩展信息。 */
    metadata: jsonb(),
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
    uniqueIndex('payment_provider_credential_ref_key').on(table.credentialRef),
    index('payment_provider_credential_option_idx').on(
      table.channel,
      table.credentialType,
      table.status,
      table.expiredAt,
    ),
    check(
      'payment_provider_credential_channel_valid_chk',
      sql`${table.channel} in (1, 2)`,
    ),
    check(
      'payment_provider_credential_type_valid_chk',
      sql`${table.credentialType} in (1, 2, 3, 4)`,
    ),
    check(
      'payment_provider_credential_status_valid_chk',
      sql`${table.status} in (1, 2, 3)`,
    ),
  ],
)

export type PaymentProviderCredentialSelect =
  typeof paymentProviderCredential.$inferSelect
export type PaymentProviderCredentialInsert =
  typeof paymentProviderCredential.$inferInsert
