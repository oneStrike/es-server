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
 * 会员权益定义表。
 * 定义可展示和可发放的会员权益，实际发放仍由券、道具或权益事实承载。
 */
export const membershipBenefitDefinition = snakeCase.table(
  'membership_benefit_definition',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 权益业务键，由服务端生成。 */
    code: varchar({ length: 80 }).notNull(),
    /** 权益名称。 */
    name: varchar({ length: 80 }).notNull(),
    /** 权益图标资源键或 URL。 */
    icon: varchar({ length: 300 }).default('').notNull(),
    /** 权益类型（1=纯展示；2=券发放；3=道具/装扮发放；4=订阅权益；5=无广告策略；6=内容优先看策略）。 */
    benefitType: smallint().notNull(),
    /** 权益说明。 */
    description: varchar({ length: 500 }).default('').notNull(),
    /** 是否启用。 */
    isEnabled: boolean().default(true).notNull(),
    /** 排序值，0=默认排序。 */
    sortOrder: smallint().default(0).notNull(),
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
    unique('membership_benefit_definition_code_key').on(table.code),
    index('membership_benefit_definition_enabled_sort_order_idx').on(
      table.isEnabled,
      table.sortOrder,
    ),
    check(
      'membership_benefit_definition_type_valid_chk',
      sql`${table.benefitType} in (1, 2, 3, 4, 5, 6)`,
    ),
    check(
      'membership_benefit_definition_sort_order_non_negative_chk',
      sql`${table.sortOrder} >= 0`,
    ),
  ],
)

export type MembershipBenefitDefinitionSelect =
  typeof membershipBenefitDefinition.$inferSelect
export type MembershipBenefitDefinitionInsert =
  typeof membershipBenefitDefinition.$inferInsert
