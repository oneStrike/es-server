/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, smallint, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 成长结算审计日志表
 * 记录规则判定与结算结果，便于排障和运营追踪
 */
export const growthAuditLog = pgTable("growth_audit_log", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 请求链路ID（可选）
   */
  requestId: varchar({ length: 80 }),
  /**
   * 用户ID
   */
  userId: integer().notNull(),
  /**
   * 幂等业务键
   */
  bizKey: varchar({ length: 120 }).notNull(),
  /**
   * 资产类型（1=积分，2=经验值，3=徽章）
   */
  assetType: smallint().notNull(),
  /**
   * 动作（GRANT / CONSUME / APPLY_RULE / ASSIGN_BADGE）
   */
  action: varchar({ length: 30 }).notNull(),
  /**
   * 规则类型（可选，取值见成长规则枚举）
   */
  ruleType: smallint(),
  /**
   * 判定结果（allow / deny）
   */
  decision: varchar({ length: 20 }).notNull(),
  /**
   * 拒绝或处理原因
   */
  reason: varchar({ length: 80 }),
  /**
   * 请求变更值（可选）
   */
  deltaRequested: integer(),
  /**
   * 实际变更值（可选）
   */
  deltaApplied: integer(),
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
   * 业务键检索索引
   */
  index("growth_audit_log_user_id_biz_key_idx").on(table.userId, table.bizKey),
  /**
   * 判定统计索引
   */
  index("growth_audit_log_asset_type_action_decision_created_at_idx").on(table.assetType, table.action, table.decision, table.createdAt),
  /**
   * 请求链路索引
   */
  index("growth_audit_log_request_id_idx").on(table.requestId),
  check("growth_audit_log_asset_type_valid_chk", sql`${table.assetType} in (1, 2, 3)`),
]);
