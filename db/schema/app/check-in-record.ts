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
  /**
   * 签到记录主键。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 记录归属用户 ID。
   */
  userId: integer().notNull(),
  /**
   * 记录归属计划 ID。
   */
  planId: integer().notNull(),
  /**
   * 记录归属周期 ID。
   */
  cycleId: integer().notNull(),
  /**
   * 签到自然日。
   * 使用 `date` 语义表达“哪一天完成了签到事实”。
   */
  signDate: date().notNull(),
  /**
   * 签到类型。
   * 区分正常签到与补签，用于日历展示与补签额度统计。
   */
  recordType: smallint().notNull(),
  /**
   * 基础签到奖励状态。
   * 仅描述基础奖励，不覆盖连续奖励发放状态；没有基础奖励时允许为 `null`。
   */
  rewardStatus: smallint(),
  /**
   * 基础签到奖励结果类型。
   * 用于区分真实落账、幂等命中与失败；没有基础奖励时允许为 `null`。
   */
  rewardResultType: smallint(),
  /**
   * 本次基础奖励解析来源。
   * 使用字符串枚举表达命中的奖励层级，`BASE_REWARD` 不再依赖具体规则行。
   */
  resolvedRewardSourceType: varchar({ length: 32 }),
  /**
   * 本次基础奖励命中的规则 ID。
   * 与 `resolvedRewardSourceType` 组合解释的软引用；命中默认基础奖励时为空。
   */
  resolvedRewardRuleId: integer(),
  /**
   * 本次基础奖励解析结果快照。
   * 冻结签到当日实际结算的奖励配置，来源可能是具体日期规则、周期模式规则或计划默认基础奖励。
   */
  resolvedRewardConfig: jsonb(),
  /**
   * 业务幂等键。
   * 用于重复提交、补偿重放和账本幂等收口。
   */
  bizKey: varchar({ length: 180 }).notNull(),
  /**
   * 基础奖励对应到账本记录 ID 列表。
   * 幂等命中或无基础奖励时通常为空数组。
   */
  baseRewardLedgerIds: integer().array().default(sql`ARRAY[]::integer[]`).notNull(),
  /**
   * 操作来源类型。
   * 用于区分用户主动签到、后台修复或系统补偿等来源。
   */
  operatorType: smallint().notNull(),
  /**
   * 备注。
   * 主要用于后台修复、补签排障或补偿说明。
   */
  remark: varchar({ length: 500 }),
  /**
   * 最近一次基础奖励失败原因。
   */
  lastRewardError: varchar({ length: 500 }),
  /**
   * 签到扩展上下文。
   * 可保存操作来源、补签入口和排障附加信息。
   */
  context: jsonb(),
  /**
   * 最近一次基础奖励状态落定时间。
   */
  rewardSettledAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 签到事实创建时间。
   * 该字段即为签到事实审计时间，不等同于 signDate 的自然日语义。
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 签到记录最近更新时间。
   * 主要反映奖励补偿、上下文补写或后台修复结果。
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  /**
   * 同用户、同计划、同签到日唯一约束。
   */
  unique('check_in_record_user_plan_sign_date_key').on(
    table.userId,
    table.planId,
    table.signDate,
  ),
  /**
   * 同用户业务幂等键唯一约束。
   */
  unique('check_in_record_user_biz_key_key').on(table.userId, table.bizKey),
  /**
   * 周期索引。
   */
  index('check_in_record_cycle_id_idx').on(table.cycleId),
  /**
   * 用户与计划索引。
   */
  index('check_in_record_user_id_plan_id_idx').on(table.userId, table.planId),
  /**
   * 签到日期索引。
   */
  index('check_in_record_sign_date_idx').on(table.signDate),
  /**
   * 奖励状态索引。
   */
  index('check_in_record_reward_status_idx').on(table.rewardStatus),
  /**
   * 签到类型必须落在受支持枚举内。
   */
  check(
    'check_in_record_record_type_valid_chk',
    sql`${table.recordType} in (1, 2)`,
  ),
  /**
   * 基础奖励状态必须落在受支持枚举内或为空。
   */
  check(
    'check_in_record_reward_status_valid_chk',
    sql`${table.rewardStatus} is null or ${table.rewardStatus} in (0, 1, 2)`,
  ),
  /**
   * 基础奖励结果类型必须落在受支持枚举内或为空。
   */
  check(
    'check_in_record_reward_result_type_valid_chk',
    sql`${table.rewardResultType} is null or ${table.rewardResultType} in (1, 2, 3)`,
  ),
  /**
   * 操作来源必须落在受支持枚举内。
   */
  check(
    'check_in_record_operator_type_valid_chk',
    sql`${table.operatorType} in (1, 2, 3)`,
  ),
  /**
   * 奖励解析来源必须落在受支持枚举内或为空。
   */
  check(
    'check_in_record_reward_source_type_valid_chk',
    sql`${table.resolvedRewardSourceType} is null or ${table.resolvedRewardSourceType} in ('BASE_REWARD', 'DATE_RULE', 'PATTERN_RULE')`,
  ),
  /**
   * 基础奖励状态、结果类型和落定时间必须保持一致。
   */
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
  /**
   * 奖励解析快照与奖励状态必须保持一致。
   */
  check(
    'check_in_record_reward_resolution_consistent_chk',
    sql`(
      ${table.rewardStatus} is null
      and ${table.resolvedRewardSourceType} is null
      and ${table.resolvedRewardRuleId} is null
      and ${table.resolvedRewardConfig} is null
    ) or (
      ${table.rewardStatus} in (0, 1, 2)
      and ${table.resolvedRewardSourceType} in ('BASE_REWARD', 'DATE_RULE', 'PATTERN_RULE')
      and (
        (${table.resolvedRewardSourceType} = 'BASE_REWARD' and ${table.resolvedRewardRuleId} is null)
        or (${table.resolvedRewardSourceType} in ('DATE_RULE', 'PATTERN_RULE') and ${table.resolvedRewardRuleId} is not null)
      )
      and ${table.resolvedRewardConfig} is not null
    )`,
  ),
])

export type CheckInRecord = typeof checkInRecord.$inferSelect
export type CheckInRecordSelect = CheckInRecord
export type CheckInRecordInsert = typeof checkInRecord.$inferInsert
