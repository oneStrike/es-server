/**
 * Auto-converted from legacy schema.
 */

import { index, integer, jsonb, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 统一成长流水表
 * 记录积分、经验等可计量资产的变更流水
 */
export const growthLedgerRecord = pgTable("growth_ledger_record", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 用户ID
   */
  userId: integer().notNull(),
  /**
   * 资产类型（1=积分 2=经验值）
   */
  assetType: smallint().notNull(),
  /**
   * 变更值（正数发放，负数扣减）
   */
  delta: integer().notNull(),
  /**
   * 变更前余额
   */
  beforeValue: integer().notNull(),
  /**
   * 变更后余额
   */
  afterValue: integer().notNull(),
  /**
   * 幂等业务键（同用户下全局唯一）
   */
  bizKey: varchar({ length: 120 }).notNull(),
  /**
   * 账本来源
   * 用于区分基础成长规则奖励、任务 bonus 和其他手工/业务来源
   */
  source: varchar({ length: 40 }).notNull(),
  /**
   * 规则类型（可选）
   */
  ruleType: smallint(),
  /**
   * 规则ID（可选）
   */
  ruleId: integer(),
  /**
   * 目标类型（可选）
   */
  targetType: smallint(),
  /**
   * 目标ID（可选）
   */
  targetId: integer(),
  /**
   * 备注
   */
  remark: varchar({ length: 500 }),
  /**
   * 扩展上下文
   */
  context: jsonb(),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
  /**
   * 幂等唯一约束：同一用户同一业务键只允许生效一次
   */
  unique("growth_ledger_record_user_id_biz_key_key").on(table.userId, table.bizKey),
  /**
   * 账单查询索引
   */
  index("growth_ledger_record_user_id_asset_type_created_at_idx").on(table.userId, table.assetType, table.createdAt),
  /**
   * 目标检索索引
   */
  index("growth_ledger_record_target_type_target_id_idx").on(table.targetType, table.targetId),
]);
