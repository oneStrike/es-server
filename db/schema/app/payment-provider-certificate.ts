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
 * 支付 provider 证书注册表。
 * 只保存证书引用、序列号、指纹和过期时间，不保存证书私钥明文。
 */
export const paymentProviderCertificate = snakeCase.table(
  'payment_provider_certificate',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 支付渠道（1=支付宝；2=微信）。 */
    channel: smallint().notNull(),
    /** 证书用途（1=应用证书；2=平台证书；3=根证书；4=公钥证书）。 */
    certificateType: smallint().notNull(),
    /** 外部证书引用。 */
    certificateRef: varchar({ length: 180 }).notNull(),
    /** provider 证书序列号。 */
    serialNo: varchar({ length: 160 }).default('').notNull(),
    /** 证书版本标签。 */
    versionLabel: varchar({ length: 80 }).default('').notNull(),
    /** 运营展示名称。 */
    displayName: varchar({ length: 160 }).default('').notNull(),
    /** 证书指纹。 */
    fingerprint: varchar({ length: 160 }).default('').notNull(),
    /** 证书状态（1=启用；2=禁用；3=过期）。 */
    status: smallint().default(1).notNull(),
    /** 过期时间。 */
    expiredAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 非敏感扩展信息。 */
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
    uniqueIndex('payment_provider_certificate_ref_key').on(
      table.certificateRef,
    ),
    index('payment_provider_certificate_option_idx').on(
      table.channel,
      table.certificateType,
      table.status,
      table.expiredAt,
    ),
    index('payment_provider_certificate_serial_idx').on(
      table.channel,
      table.serialNo,
    ),
    check(
      'payment_provider_certificate_channel_valid_chk',
      sql`${table.channel} in (1, 2)`,
    ),
    check(
      'payment_provider_certificate_type_valid_chk',
      sql`${table.certificateType} in (1, 2, 3, 4)`,
    ),
    check(
      'payment_provider_certificate_status_valid_chk',
      sql`${table.status} in (1, 2, 3)`,
    ),
  ],
)

export type PaymentProviderCertificateSelect =
  typeof paymentProviderCertificate.$inferSelect
export type PaymentProviderCertificateInsert =
  typeof paymentProviderCertificate.$inferInsert
