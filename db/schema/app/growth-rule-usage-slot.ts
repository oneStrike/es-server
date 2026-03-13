/**
 * Auto-converted from Prisma schema.
 */

import { index, integer, pgTable, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 成长规则限流槽位表
 * 通过唯一约束实现高并发下的 daily/total/cooldown 防重复命中
 */
export const growthRuleUsageSlot = pgTable("growth_rule_usage_slot", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 用户ID
   */
  userId: integer().notNull(),
  /**
   * 资产类型（POINTS / EXPERIENCE）
   */
  assetType: varchar({ length: 30 }).notNull(),
  /**
   * 规则键（如 points:10 / experience:6）
   */
  ruleKey: varchar({ length: 80 }).notNull(),
  /**
   * 槽位类型（DAILY / TOTAL / COOLDOWN）
   */
  slotType: varchar({ length: 20 }).notNull(),
  /**
   * 槽位值（如 2026-03-07 / all / 2026-03-07T09:15）
   */
  slotValue: varchar({ length: 60 }).notNull(),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
  /**
   * 唯一槽位约束：核心并发防重
   */
  unique("growth_rule_usage_slot_user_id_asset_type_rule_key_slot_type_slot_value_key").on(table.userId, table.assetType, table.ruleKey, table.slotType, table.slotValue),
  /**
   * 用户规则检索索引
   */
  index("growth_rule_usage_slot_user_id_asset_type_rule_key_created_at_idx").on(table.userId, table.assetType, table.ruleKey, table.createdAt),
]);
