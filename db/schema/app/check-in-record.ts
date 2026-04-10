import { sql } from 'drizzle-orm'
import {
  check,
  date,
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
 * 每日签到事实。
 *
 * 同一用户在同一计划、同一自然日只能拥有一条有效签到记录；补签不会生成
 * 第二条同日事实，而是以 `recordType` 标记本次事实来源。
 */
export const checkInRecord = pgTable('check_in_record', {
  /** 签到记录主键。 */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** 记录归属用户 ID。 */
  userId: integer().notNull(),
  /** 记录归属计划 ID。 */
  planId: integer().notNull(),
  /** 记录归属周期 ID。 */
  cycleId: integer().notNull(),
  /** 签到自然日。 */
  signDate: date().notNull(),
  /** 签到类型。 */
  recordType: smallint().notNull(),
  /** 基础签到奖励状态。 */
  rewardStatus: smallint(),
  /** 基础签到奖励结果类型。 */
  rewardResultType: smallint(),
  /** 本次基础奖励解析来源。 */
  resolvedRewardSourceType: varchar({ length: 32 }),
  /**
   * 本次基础奖励命中的规则键。
   *
   * `null` 表示默认基础奖励；日期/模式奖励分别使用稳定字符串键。
   */
  resolvedRewardRuleKey: varchar({ length: 32 }),
  /** 本次基础奖励解析结果快照。 */
  resolvedRewardConfig: jsonb(),
  /** 业务幂等键。 */
  bizKey: varchar({ length: 180 }).notNull(),
  /** 基础奖励对应到账本记录 ID 列表。 */
  baseRewardLedgerIds: integer().array().default(sql`ARRAY[]::integer[]`).notNull(),
  /** 操作来源类型。 */
  operatorType: smallint().notNull(),
  /** 备注。 */
  remark: varchar({ length: 500 }),
  /** 最近一次基础奖励失败原因。 */
  lastRewardError: varchar({ length: 500 }),
  /** 签到扩展上下文。 */
  context: jsonb(),
  /** 最近一次基础奖励状态落定时间。 */
  rewardSettledAt: timestamp({ withTimezone: true, precision: 6 }),
  /** 签到事实创建时间。 */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /** 签到记录最近更新时间。 */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  unique('check_in_record_user_plan_sign_date_key').on(
    table.userId,
    table.planId,
    table.signDate,
  ),
  unique('check_in_record_user_biz_key_key').on(table.userId, table.bizKey),
  index('check_in_record_cycle_id_idx').on(table.cycleId),
  index('check_in_record_user_id_plan_id_idx').on(table.userId, table.planId),
  index('check_in_record_sign_date_idx').on(table.signDate),
  index('check_in_record_reward_status_idx').on(table.rewardStatus),
  check(
    'check_in_record_record_type_valid_chk',
    sql`${table.recordType} in (1, 2)`,
  ),
  check(
    'check_in_record_reward_status_valid_chk',
    sql`${table.rewardStatus} is null or ${table.rewardStatus} in (0, 1, 2)`,
  ),
  check(
    'check_in_record_reward_result_type_valid_chk',
    sql`${table.rewardResultType} is null or ${table.rewardResultType} in (1, 2, 3)`,
  ),
  check(
    'check_in_record_operator_type_valid_chk',
    sql`${table.operatorType} in (1, 2, 3)`,
  ),
  check(
    'check_in_record_reward_source_type_valid_chk',
    sql`${table.resolvedRewardSourceType} is null or ${table.resolvedRewardSourceType} in ('BASE_REWARD', 'DATE_RULE', 'PATTERN_RULE')`,
  ),
  check(
    'check_in_record_reward_state_consistent_chk',
    sql`(
      ${table.rewardStatus} is null
      and ${table.rewardResultType} is null
      and ${table.rewardSettledAt} is null
    ) or (
      ${table.rewardStatus} = 0
      and ${table.rewardResultType} is null
      and ${table.rewardSettledAt} is null
    ) or (
      ${table.rewardStatus} = 1
      and ${table.rewardResultType} in (1, 2)
      and ${table.rewardSettledAt} is not null
    ) or (
      ${table.rewardStatus} = 2
      and ${table.rewardResultType} = 3
      and ${table.rewardSettledAt} is not null
    )`,
  ),
  check(
    'check_in_record_reward_resolution_consistent_chk',
    sql`(
      ${table.rewardStatus} is null
      and ${table.resolvedRewardSourceType} is null
      and ${table.resolvedRewardRuleKey} is null
      and ${table.resolvedRewardConfig} is null
    ) or (
      ${table.rewardStatus} in (0, 1, 2)
      and ${table.resolvedRewardSourceType} in ('BASE_REWARD', 'DATE_RULE', 'PATTERN_RULE')
      and ${table.resolvedRewardConfig} is not null
    )`,
  ),
])

export type CheckInRecord = typeof checkInRecord.$inferSelect
export type CheckInRecordSelect = CheckInRecord
export type CheckInRecordInsert = typeof checkInRecord.$inferInsert
