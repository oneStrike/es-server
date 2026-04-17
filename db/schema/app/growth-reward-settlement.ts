import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 通用成长奖励补偿事实表。
 *
 * 统一承载通用成长事件、任务奖励、签到基础奖励、签到连续奖励的补偿事实，
 * 用于保留 durable 失败事实、支持后台分页排障与后续补偿重试。
 */
export const growthRewardSettlement = pgTable('growth_reward_settlement', {
  /** 主键 ID。 */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** 奖励归属用户 ID。 */
  userId: integer().notNull(),
  /** 幂等业务键。 */
  bizKey: varchar({ length: 160 }).notNull(),
  /** 补偿记录类型（1=通用成长事件；2=任务奖励；3=签到基础奖励；4=签到连续奖励）。 */
  settlementType: smallint().notNull(),
  /** 奖励来源。 */
  source: varchar({ length: 40 }).notNull(),
  /** 来源事实主键（可选）。 */
  sourceRecordId: integer(),
  /** 成长事件编码（任务奖励可为空）。 */
  eventCode: integer(),
  /** 成长事件 key（任务奖励可为空）。 */
  eventKey: varchar({ length: 80 }),
  /** 目标类型（可选）。 */
  targetType: smallint(),
  /** 目标 ID（可选）。 */
  targetId: integer(),
  /** 事件发生时间。 */
  eventOccurredAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
  /**
   * 补偿状态。
   * 0=待补偿重试，1=已补偿成功，2=终态失败无需再重试。
   */
  settlementStatus: smallint().default(0).notNull(),
  /** 本次补偿结果类型（1=本次真实落账，2=命中幂等未重复落账，3=本次处理失败）。 */
  settlementResultType: smallint(),
  /** 本次补偿关联到账本记录 ID 列表。 */
  ledgerRecordIds: integer().array().default(sql`ARRAY[]::integer[]`).notNull(),
  /** 已执行的补偿重试次数。 */
  retryCount: integer().default(0).notNull(),
  /** 最近一次重试时间。 */
  lastRetryAt: timestamp({ withTimezone: true, precision: 6 }),
  /** 最近一次补偿状态落定时间。 */
  settledAt: timestamp({ withTimezone: true, precision: 6 }),
  /** 最近一次失败原因。 */
  lastError: varchar({ length: 500 }),
  /** 重试所需的原始派发载荷快照。 */
  requestPayload: jsonb().notNull(),
  /** 记录创建时间。 */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /** 记录更新时间。 */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  unique('growth_reward_settlement_user_biz_key_key').on(
    table.userId,
    table.bizKey,
  ),
  index('growth_reward_settlement_status_created_at_idx').on(
    table.settlementStatus,
    table.createdAt,
  ),
  index('growth_reward_settlement_type_status_created_at_idx').on(
    table.settlementType,
    table.settlementStatus,
    table.createdAt,
  ),
  index('growth_reward_settlement_user_id_status_created_at_idx').on(
    table.userId,
    table.settlementStatus,
    table.createdAt,
  ),
  index('growth_reward_settlement_source_record_id_idx').on(
    table.sourceRecordId,
  ),
  index('growth_reward_settlement_event_code_created_at_idx').on(
    table.eventCode,
    table.createdAt,
  ),
  check(
    'growth_reward_settlement_user_id_positive_chk',
    sql`${table.userId} > 0`,
  ),
  check(
    'growth_reward_settlement_event_code_positive_chk',
    sql`${table.eventCode} is null or ${table.eventCode} > 0`,
  ),
  check(
    'growth_reward_settlement_biz_key_not_blank_chk',
    sql`btrim(${table.bizKey}) <> ''`,
  ),
  check(
    'growth_reward_settlement_type_valid_chk',
    sql`${table.settlementType} in (1, 2, 3, 4)`,
  ),
  check(
    'growth_reward_settlement_event_key_not_blank_chk',
    sql`${table.eventKey} is null or btrim(${table.eventKey}) <> ''`,
  ),
  check(
    'growth_reward_settlement_source_not_blank_chk',
    sql`btrim(${table.source}) <> ''`,
  ),
  check(
    'growth_reward_settlement_source_record_id_positive_chk',
    sql`${table.sourceRecordId} is null or ${table.sourceRecordId} > 0`,
  ),
  check(
    'growth_reward_settlement_status_valid_chk',
    sql`${table.settlementStatus} in (0, 1, 2)`,
  ),
  check(
    'growth_reward_settlement_result_type_valid_chk',
    sql`${table.settlementResultType} is null or ${table.settlementResultType} in (1, 2, 3)`,
  ),
  check(
    'growth_reward_settlement_retry_count_non_negative_chk',
    sql`${table.retryCount} >= 0`,
  ),
])

export type GrowthRewardSettlement = typeof growthRewardSettlement.$inferSelect
export type GrowthRewardSettlementSelect = GrowthRewardSettlement
export type GrowthRewardSettlementInsert = typeof growthRewardSettlement.$inferInsert
