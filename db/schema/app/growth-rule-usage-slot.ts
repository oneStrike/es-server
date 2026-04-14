/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

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
   * 资产类型（1=积分，2=经验值）
   */
  assetType: smallint().notNull(),
  /**
   * 规则键（如 points:10 / experience:6）
   */
  ruleKey: varchar({ length: 80 }).notNull(),
  /**
   * 槽位类型（1=每日限额，2=总限额，3=冷却占位）
   */
  slotType: smallint().notNull(),
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
   * 注意：PostgreSQL 索引名最大 63 字符，此名称已被自动截断
   */
  unique("growth_rule_usage_slot_user_id_asset_type_rule_key_slot_typ_key").on(table.userId, table.assetType, table.ruleKey, table.slotType, table.slotValue),
  /**
   * 用户规则检索索引
   * 注意：PostgreSQL 索引名最大 63 字符，此名称已被自动截断
   */
  index("growth_rule_usage_slot_user_id_asset_type_rule_key_created__idx").on(table.userId, table.assetType, table.ruleKey, table.createdAt),
  check("growth_rule_usage_slot_asset_type_valid_chk", sql`${table.assetType} in (1, 2)`),
  check("growth_rule_usage_slot_slot_type_valid_chk", sql`${table.slotType} in (1, 2, 3)`),
]);
