import {
  bigint,
  primaryKey,
  snakeCase,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 数据库迁移审计表。
 * 记录破坏性迁移的计数指标，供发布后 reconcile SQL 输出数据影响。
 */
export const migrationAudit = snakeCase.table(
  'migration_audit',
  {
    /** 迁移唯一键。 */
    migrationKey: varchar({ length: 160 }).notNull(),
    /** 指标名称。 */
    metric: varchar({ length: 160 }).notNull(),
    /** 指标值。 */
    value: bigint({ mode: 'bigint' }).notNull(),
    /** 记录创建或刷新时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.migrationKey, table.metric],
      name: 'migration_audit_pkey',
    }),
  ],
)

export type MigrationAuditSelect = typeof migrationAudit.$inferSelect
export type MigrationAuditInsert = typeof migrationAudit.$inferInsert
