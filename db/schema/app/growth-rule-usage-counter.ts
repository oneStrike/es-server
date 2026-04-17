import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 成长规则使用计数表。
 *
 * 以单行累计值替代历史槽位扫描，实现规则维度的 daily/total/cooldown 计数。
 */
export const growthRuleUsageCounter = pgTable('growth_rule_usage_counter', {
  /** 主键 ID。 */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** 用户 ID。 */
  userId: integer().notNull(),
  /** 资产类型（1=积分；2=经验；3=道具；4=虚拟货币；5=等级）。 */
  assetType: smallint().notNull(),
  /** 资产键。 */
  assetKey: varchar({ length: 64 }).default('').notNull(),
  /** 规则键。 */
  ruleKey: varchar({ length: 80 }).notNull(),
  /** 计数作用域类型（1=每日；2=总量；3=冷却）。 */
  scopeType: smallint().notNull(),
  /** 计数作用域值（如 2026-04-17 / all / 2026-04-17T09:15）。 */
  scopeKey: varchar({ length: 60 }).notNull(),
  /** 当前已使用次数。 */
  usedCount: integer().default(0).notNull(),
  /** 创建时间。 */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /** 更新时间。 */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  unique('growth_rule_usage_counter_user_id_asset_type_asset_key_rul_key').on(
    table.userId,
    table.assetType,
    table.assetKey,
    table.ruleKey,
    table.scopeType,
    table.scopeKey,
  ),
  index('growth_rule_usage_counter_user_id_asset_type_rule_key_idx').on(
    table.userId,
    table.assetType,
    table.ruleKey,
    table.updatedAt,
  ),
  check(
    'growth_rule_usage_counter_asset_type_valid_chk',
    sql`${table.assetType} in (1, 2, 3, 4, 5)`,
  ),
  check(
    'growth_rule_usage_counter_scope_type_valid_chk',
    sql`${table.scopeType} in (1, 2, 3)`,
  ),
  check(
    'growth_rule_usage_counter_used_count_positive_chk',
    sql`${table.usedCount} >= 0`,
  ),
])

export type GrowthRuleUsageCounter = typeof growthRuleUsageCounter.$inferSelect
export type GrowthRuleUsageCounterSelect = GrowthRuleUsageCounter
export type GrowthRuleUsageCounterInsert = typeof growthRuleUsageCounter.$inferInsert
