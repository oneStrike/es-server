import { sql } from 'drizzle-orm'
import {
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
])

export type CheckInRecord = typeof checkInRecord.$inferSelect
export type CheckInRecordSelect = CheckInRecord
export type CheckInRecordInsert = typeof checkInRecord.$inferInsert
