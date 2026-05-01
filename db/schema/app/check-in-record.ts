import { sql } from 'drizzle-orm'
import {
  check,
  date,
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
 * 每日签到事实。
 *
 * 同一用户在同一自然日只能拥有一条签到事实。奖励配置在写入时直接冻结到
 * `resolvedRewardItems` 和相关图标快照字段，后续配置更新不回溯影响历史事实。
 */
export const checkInRecord = snakeCase.table(
  'check_in_record',
  {
    /** 签到记录主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 记录归属用户 ID。 */
    userId: integer().notNull(),
    /** 签到自然日。 */
    signDate: date().notNull(),
    /** 签到类型（1=正常签到，2=补签）。 */
    recordType: smallint().notNull(),
    /** 本次基础奖励解析来源（1=默认基础奖励，2=具体日期奖励，3=周期模式奖励）。 */
    resolvedRewardSourceType: smallint(),
    /**
     * 本次基础奖励命中的规则键。
     *
     * `null` 表示默认基础奖励；日期/模式奖励分别使用稳定字符串键。
     */
    resolvedRewardRuleKey: varchar({ length: 32 }),
    /** 本次基础奖励解析结果快照；签到奖励项允许携带图标元数据。 */
    resolvedRewardItems: jsonb(),
    /** 本次基础奖励概览图标快照。 */
    resolvedRewardOverviewIconUrl: varchar({ length: 500 }),
    /** 本次补签图标快照；普通签到时为空。 */
    resolvedMakeupIconUrl: varchar({ length: 500 }),
    /** 关联的奖励结算事实 ID。 */
    rewardSettlementId: integer(),
    /** 业务幂等键。 */
    bizKey: varchar({ length: 180 }).notNull(),
    /** 操作来源类型（1=用户主动操作，2=管理员补偿或修复，3=系统任务补偿）。 */
    operatorType: smallint().notNull(),
    /** 备注。 */
    remark: varchar({ length: 500 }),
    /** 签到扩展上下文。 */
    context: jsonb(),
    /** 签到事实创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 签到记录最近更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('check_in_record_user_sign_date_key').on(
      table.userId,
      table.signDate,
    ),
    unique('check_in_record_user_biz_key_key').on(table.userId, table.bizKey),
    index('check_in_record_user_id_sign_date_idx').on(
      table.userId,
      table.signDate,
    ),
    index('check_in_record_reward_settlement_id_idx').on(
      table.rewardSettlementId,
    ),
    index('check_in_record_reward_overview_icon_url_idx').on(
      table.resolvedRewardOverviewIconUrl,
    ),
    index('check_in_record_sign_date_idx').on(table.signDate),
    check(
      'check_in_record_record_type_valid_chk',
      sql`${table.recordType} in (1, 2)`,
    ),
    check(
      'check_in_record_operator_type_valid_chk',
      sql`${table.operatorType} in (1, 2, 3)`,
    ),
    check(
      'check_in_record_reward_source_type_valid_chk',
      sql`${table.resolvedRewardSourceType} is null or ${table.resolvedRewardSourceType} in (1, 2, 3)`,
    ),
    check(
      'check_in_record_reward_settlement_id_positive_chk',
      sql`${table.rewardSettlementId} is null or ${table.rewardSettlementId} > 0`,
    ),
    check(
      'check_in_record_reward_resolution_consistent_chk',
      sql`(
      ${table.resolvedRewardItems} is null
      and ${table.resolvedRewardSourceType} is null
      and ${table.resolvedRewardRuleKey} is null
    ) or (
      ${table.resolvedRewardItems} is not null
      and ${table.resolvedRewardSourceType} in (1, 2, 3)
    )`,
    ),
  ],
)

export type CheckInRecordSelect = typeof checkInRecord.$inferSelect
export type CheckInRecordInsert = typeof checkInRecord.$inferInsert
