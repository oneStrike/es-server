import { sql } from 'drizzle-orm'
import {
  boolean,
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
 * 连续签到奖励发放事实。
 *
 * 统一记录日常连续签到和活动连续签到的奖励发放结果，通过 `scopeType` 区分归属。
 */
export const checkInStreakGrant = pgTable(
  'check_in_streak_grant',
  {
    /** 发放事实主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 发放归属用户 ID。 */
    userId: integer().notNull(),
    /** 发放作用域（1=日常连续签到；2=活动连续签到）。 */
    scopeType: smallint().notNull(),
    /** 日常连续签到配置版本 ID。 */
    configVersionId: integer(),
    /** 活动连续签到活动 ID。 */
    activityId: integer(),
    /** 命中的规则编码。 */
    ruleCode: varchar({ length: 50 }).notNull(),
    /** 命中的连续签到阈值。 */
    streakDays: integer().notNull(),
    /** 奖励快照。 */
    rewardItems: jsonb().notNull(),
    /** 是否允许重复发放。 */
    repeatable: boolean().default(false).notNull(),
    /** 触发本次奖励的签到日期。 */
    triggerSignDate: date().notNull(),
    /** 关联的奖励结算记录 ID。 */
    rewardSettlementId: integer(),
    /** 幂等业务键。 */
    bizKey: varchar({ length: 200 }).notNull(),
    /** 扩展上下文。 */
    context: jsonb(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 最近更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('check_in_streak_grant_user_biz_key_key').on(
      table.userId,
      table.bizKey,
    ),
    index('check_in_streak_grant_scope_type_idx').on(table.scopeType),
    index('check_in_streak_grant_config_version_id_idx').on(
      table.configVersionId,
    ),
    index('check_in_streak_grant_activity_id_idx').on(table.activityId),
    index('check_in_streak_grant_user_trigger_sign_date_idx').on(
      table.userId,
      table.triggerSignDate,
    ),
    index('check_in_streak_grant_reward_settlement_id_idx').on(
      table.rewardSettlementId,
    ),
    check(
      'check_in_streak_grant_scope_type_valid_chk',
      sql`${table.scopeType} in (1, 2)`,
    ),
    check(
      'check_in_streak_grant_streak_days_positive_chk',
      sql`${table.streakDays} > 0`,
    ),
    check(
      'check_in_streak_grant_config_version_id_positive_chk',
      sql`${table.configVersionId} is null or ${table.configVersionId} > 0`,
    ),
    check(
      'check_in_streak_grant_activity_id_positive_chk',
      sql`${table.activityId} is null or ${table.activityId} > 0`,
    ),
    check(
      'check_in_streak_grant_reward_settlement_id_positive_chk',
      sql`${table.rewardSettlementId} is null or ${table.rewardSettlementId} > 0`,
    ),
    check(
      'check_in_streak_grant_scope_ref_consistent_chk',
      sql`(
        ${table.scopeType} = 1
        and ${table.configVersionId} is not null
        and ${table.activityId} is null
      ) or (
        ${table.scopeType} = 2
        and ${table.configVersionId} is null
        and ${table.activityId} is not null
      )`,
    ),
  ],
)

export type CheckInStreakGrant = typeof checkInStreakGrant.$inferSelect
export type CheckInStreakGrantSelect = CheckInStreakGrant
export type CheckInStreakGrantInsert = typeof checkInStreakGrant.$inferInsert
