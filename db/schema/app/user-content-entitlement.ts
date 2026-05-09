import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 用户内容权益事实表。
 * 阅读放行、已购状态和购买计数统一读取这里的有效权益。
 */
export const userContentEntitlement = snakeCase.table(
  'user_content_entitlement',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 用户 ID。 */
    userId: integer().notNull(),
    /** 权益目标类型（1=漫画章节；2=小说章节）。 */
    targetType: smallint().notNull(),
    /** 权益目标 ID。 */
    targetId: integer().notNull(),
    /** 授权来源（1=购买；2=阅读券；3=广告；4=后台补偿；5=VIP 试用）。 */
    grantSource: smallint().notNull(),
    /** 来源 ID，例如购买记录、券实例、广告奖励或补偿记录 ID。 */
    sourceId: integer(),
    /** 来源业务键，供广告奖励、补偿批次等开放来源追踪。 */
    sourceKey: varchar({ length: 120 }),
    /** 权益状态（1=有效；2=已撤销；3=已过期）。 */
    status: smallint().default(1).notNull(),
    /** 生效开始时间。 */
    startsAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 生效结束时间，永久权益为空。 */
    expiresAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 撤销时间。 */
    revokedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 来源快照，记录价格、券、广告或补偿上下文。 */
    grantSnapshot: jsonb(),
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
    uniqueIndex('user_content_entitlement_purchase_active_unique_idx')
      .on(table.userId, table.targetType, table.targetId)
      .where(sql`${table.grantSource} = 1 and ${table.status} = 1`),
    uniqueIndex('user_content_entitlement_coupon_source_unique_idx')
      .on(table.grantSource, table.sourceId)
      .where(sql`${table.grantSource} = 2 and ${table.sourceId} is not null`),
    index('user_content_entitlement_user_target_status_idx').on(
      table.userId,
      table.targetType,
      table.targetId,
      table.status,
    ),
    index('user_content_entitlement_source_idx').on(
      table.grantSource,
      table.sourceId,
    ),
    index('user_content_entitlement_target_status_idx').on(
      table.targetType,
      table.targetId,
      table.status,
    ),
    check(
      'user_content_entitlement_target_type_valid_chk',
      sql`${table.targetType} in (1, 2)`,
    ),
    check(
      'user_content_entitlement_grant_source_valid_chk',
      sql`${table.grantSource} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'user_content_entitlement_status_valid_chk',
      sql`${table.status} in (1, 2, 3)`,
    ),
  ],
)

export type UserContentEntitlementSelect =
  typeof userContentEntitlement.$inferSelect
export type UserContentEntitlementInsert =
  typeof userContentEntitlement.$inferInsert
