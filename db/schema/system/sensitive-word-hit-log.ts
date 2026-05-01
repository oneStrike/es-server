import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  smallint,
  snakeCase,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 敏感词命中明细表 - 记录业务审核流量中的实际命中
 */
export const sensitiveWordHitLog = snakeCase.table(
  'sensitive_word_hit_log',
  {
    /**
     * 主键ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 敏感词ID
     */
    sensitiveWordId: integer().notNull(),
    /**
     * 命中实体类型（1=主题；2=评论）
     */
    entityType: smallint().notNull(),
    /**
     * 命中实体ID
     */
    entityId: integer().notNull(),
    /**
     * 命中操作类型（1=创建；2=更新）
     */
    operationType: smallint().notNull(),
    /**
     * 命中的敏感词文本
     */
    matchedWord: varchar({ length: 100 }).notNull(),
    /**
     * 敏感词级别（1=严重；2=一般；3=轻微）
     */
    level: smallint().notNull(),
    /**
     * 敏感词类型（1=政治；2=色情；3=暴力；4=广告；5=其他）
     */
    type: smallint().notNull(),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('sensitive_word_hit_log_sensitive_word_id_created_at_idx').on(
      table.sensitiveWordId,
      table.createdAt,
    ),
    index('sensitive_word_hit_log_entity_type_entity_id_created_at_idx').on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
    index('sensitive_word_hit_log_created_at_idx').on(table.createdAt),
    check(
      'sensitive_word_hit_log_entity_type_valid_chk',
      sql`${table.entityType} in (1, 2)`,
    ),
    check(
      'sensitive_word_hit_log_operation_type_valid_chk',
      sql`${table.operationType} in (1, 2)`,
    ),
    check(
      'sensitive_word_hit_log_level_valid_chk',
      sql`${table.level} in (1, 2, 3)`,
    ),
    check(
      'sensitive_word_hit_log_type_valid_chk',
      sql`${table.type} in (1, 2, 3, 4, 5)`,
    ),
  ],
)

export type SensitiveWordHitLogSelect = typeof sensitiveWordHitLog.$inferSelect
export type SensitiveWordHitLogInsert = typeof sensitiveWordHitLog.$inferInsert
