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
 * 广告奖励记录表。
 * 广告只写临时内容权益，不进入购买记录和购买计数。
 */
export const adRewardRecord = snakeCase.table(
  'ad_reward_record',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 用户 ID。 */
    userId: integer().notNull(),
    /** 广告 provider 配置 ID。 */
    adProviderConfigId: integer().notNull(),
    /** 下发奖励时配置版本快照。 */
    adProviderConfigVersion: integer().notNull(),
    /** 密钥版本引用快照。 */
    credentialVersionRef: varchar({ length: 160 }).notNull(),
    /** 广告 provider 奖励唯一 ID。 */
    providerRewardId: varchar({ length: 160 }).notNull(),
    /** 广告位 key。 */
    placementKey: varchar({ length: 120 }).notNull(),
    /** 目标类型（1=漫画章节；2=小说章节）。 */
    targetType: smallint().notNull(),
    /** 目标 ID。 */
    targetId: integer().notNull(),
    /** 奖励状态（1=成功；2=失败；3=已撤销）。 */
    status: smallint().default(1).notNull(),
    /** 客户端上下文。 */
    clientContext: jsonb(),
    /** 原始通知 payload。 */
    rawNotifyPayload: jsonb(),
    /** 验证结果 payload。 */
    verifyPayload: jsonb(),
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
    unique('ad_reward_record_config_reward_key').on(
      table.adProviderConfigId,
      table.providerRewardId,
    ),
    index('ad_reward_record_user_target_status_idx').on(
      table.userId,
      table.targetType,
      table.targetId,
      table.status,
    ),
    check(
      'ad_reward_record_target_type_valid_chk',
      sql`${table.targetType} in (1, 2)`,
    ),
    check(
      'ad_reward_record_status_valid_chk',
      sql`${table.status} in (1, 2, 3)`,
    ),
  ],
)

export type AdRewardRecordSelect = typeof adRewardRecord.$inferSelect
export type AdRewardRecordInsert = typeof adRewardRecord.$inferInsert
