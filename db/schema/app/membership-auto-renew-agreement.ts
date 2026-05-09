import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 会员自动续费签约事实表。
 * 签约、取消和续扣订单分离建模；取消只停止后续代扣，不撤销当前订阅期。
 */
export const membershipAutoRenewAgreement = snakeCase.table(
  'membership_auto_renew_agreement',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 用户 ID。 */
    userId: integer().notNull(),
    /** VIP 套餐 ID。 */
    planId: integer().notNull(),
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
    /** 支付 provider 配置 ID。 */
    providerConfigId: integer().notNull(),
    /** 签约时 provider 配置版本快照。 */
    providerConfigVersion: integer().notNull(),
    /** 签约时密钥版本引用快照。 */
    credentialVersionRef: varchar({ length: 160 }).notNull(),
    /** 第三方签约协议号。 */
    agreementNo: varchar({ length: 160 }).notNull(),
    /** 协议状态（1=有效；2=已取消；3=已过期；4=签约失败）。 */
    status: smallint().default(1).notNull(),
    /** 签约成功时间。 */
    signedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 下次预计续扣时间。 */
    nextRenewAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 取消时间。 */
    cancelledAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 原始 provider payload。 */
    rawPayload: jsonb(),
    /** 签约配置与套餐快照，不包含明文密钥。 */
    agreementSnapshot: jsonb(),
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
    unique('membership_auto_renew_agreement_no_key').on(
      table.providerConfigId,
      table.agreementNo,
    ),
    index('membership_auto_renew_agreement_user_status_idx').on(
      table.userId,
      table.status,
    ),
    check(
      'membership_auto_renew_agreement_channel_valid_chk',
      sql`${table.channel} in (1, 2)`,
    ),
    check(
      'membership_auto_renew_agreement_scene_valid_chk',
      sql`${table.paymentScene} in (1, 2, 3)`,
    ),
    check(
      'membership_auto_renew_agreement_platform_valid_chk',
      sql`${table.platform} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'membership_auto_renew_agreement_environment_valid_chk',
      sql`${table.environment} in (1, 2)`,
    ),
    check(
      'membership_auto_renew_agreement_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4)`,
    ),
  ],
)

export type MembershipAutoRenewAgreementSelect =
  typeof membershipAutoRenewAgreement.$inferSelect
export type MembershipAutoRenewAgreementInsert =
  typeof membershipAutoRenewAgreement.$inferInsert
