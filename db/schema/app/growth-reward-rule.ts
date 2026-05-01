import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 通用成长奖励规则表。
 *
 * 使用 `type + assetType + assetKey` 统一描述成长事件对应的资产规则，
 * 替代历史 `user_point_rule` / `user_experience_rule` 双表模型。
 */
export const growthRewardRule = snakeCase.table(
  'growth_reward_rule',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 规则类型（取值见成长规则枚举）。 */
    type: smallint().notNull(),
    /**
     * 资产类型（1=积分；2=经验；3=道具；4=虚拟货币；5=等级）。
     */
    assetType: smallint().notNull(),
    /**
     * 资产键。
     * 对积分/经验等无需附加主键的资产固定为空字符串；道具/货币/等级等扩展资产可使用稳定业务键。
     */
    assetKey: varchar({ length: 64 }).default('').notNull(),
    /**
     * 规则变动值。
     * 奖励值必须为正整数；消费类扣减不再复用本表表达。
     */
    delta: integer().notNull(),
    /** 每日上限（0=无限制）。 */
    dailyLimit: integer().default(0).notNull(),
    /** 总上限（0=无限制）。 */
    totalLimit: integer().default(0).notNull(),
    /** 是否启用。 */
    isEnabled: boolean().default(true).notNull(),
    /** 备注。 */
    remark: varchar({ length: 500 }),
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
    unique('growth_reward_rule_type_asset_type_asset_key_key').on(
      table.type,
      table.assetType,
      table.assetKey,
    ),
    index('growth_reward_rule_type_idx').on(table.type),
    index('growth_reward_rule_asset_type_idx').on(table.assetType),
    index('growth_reward_rule_is_enabled_idx').on(table.isEnabled),
    check(
      'growth_reward_rule_asset_type_valid_chk',
      sql`${table.assetType} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'growth_reward_rule_asset_key_not_blank_chk',
      sql`(
      (${table.assetType} in (1, 2) and btrim(${table.assetKey}) = '')
      or (${table.assetType} in (3, 4, 5) and btrim(${table.assetKey}) <> '')
    )`,
    ),
    check(
      'growth_reward_rule_daily_limit_non_negative_chk',
      sql`${table.dailyLimit} >= 0`,
    ),
    check(
      'growth_reward_rule_total_limit_non_negative_chk',
      sql`${table.totalLimit} >= 0`,
    ),
    check('growth_reward_rule_delta_positive_chk', sql`${table.delta} > 0`),
  ],
)

export type GrowthRewardRuleSelect = typeof growthRewardRule.$inferSelect
export type GrowthRewardRuleInsert = typeof growthRewardRule.$inferInsert
