/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  smallint,
  snakeCase,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 用户等级规则表 - 定义用户等级规则，包括等级名称、所需经验、等级权益等
 */
export const userLevelRule = snakeCase.table(
  'user_level_rule',
  {
    /**
     * 主键ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 等级名称
     */
    name: varchar({ length: 20 }).notNull(),
    /**
     * 所需经验值
     */
    requiredExperience: integer().notNull(),
    /**
     * 等级描述
     */
    description: varchar({ length: 200 }),
    /**
     * 等级图标URL
     */
    icon: varchar({ length: 255 }),
    /**
     * 等级专属颜色（十六进制）
     */
    color: varchar({ length: 20 }),
    /**
     * 排序值（0=默认排序，数值越小越靠前）
     */
    sortOrder: smallint().default(0).notNull(),
    /**
     * 是否启用
     */
    isEnabled: boolean().default(true).notNull(),
    /**
     * 业务域标识（可选）
     */
    business: varchar({ length: 20 }),
    /**
     * 每日发帖数量上限（0=不限制）
     */
    dailyTopicLimit: smallint().default(0).notNull(),
    /**
     * 每日回复和评论数量上限（0=不限制）
     */
    dailyReplyCommentLimit: smallint().default(0).notNull(),
    /**
     * 发帖间隔秒数（0=不限制）
     */
    postInterval: smallint().default(0).notNull(),
    /**
     * 每日点赞次数上限（0=不限制）
     */
    dailyLikeLimit: smallint().default(0).notNull(),
    /**
     * 每日收藏次数上限（0=不限制）
     */
    dailyFavoriteLimit: smallint().default(0).notNull(),
    /**
     * 积分支付比例（0-1之间的小数，1表示原价支付）
     */
    purchasePayableRate: numeric({ precision: 3, scale: 2 })
      .default('1.00')
      .notNull(),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /**
     * 更新时间
     */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /**
     * 唯一索引: name
     */
    unique('user_level_rule_name_key').on(table.name),
    /**
     * 启用与排序索引
     */
    index('user_level_rule_is_enabled_sort_order_idx').on(
      table.isEnabled,
      table.sortOrder,
    ),
    /**
     * 按业务域和经验值稳定命中当前等级。
     */
    index('user_level_rule_business_enabled_exp_id_idx').on(
      table.business,
      table.isEnabled,
      table.requiredExperience.desc(),
      table.id.desc(),
    ),
    /**
     * 启用的业务域等级经验阈值必须唯一，默认业务域按空字符串归并。
     */
    uniqueIndex('user_level_rule_enabled_business_exp_unique_idx')
      .on(sql`COALESCE(${table.business}, '')`, table.requiredExperience)
      .where(sql`${table.isEnabled} = true`),
    /**
     * 每个启用业务域只能有一个0经验基础等级，默认业务域按空字符串归并。
     */
    uniqueIndex('user_level_rule_enabled_business_base_unique_idx')
      .on(sql`COALESCE(${table.business}, '')`)
      .where(
        sql`${table.isEnabled} = true and ${table.requiredExperience} = 0`,
      ),
    check(
      'user_level_rule_required_experience_non_negative_chk',
      sql`${table.requiredExperience} >= 0`,
    ),
    check(
      'user_level_rule_sort_order_non_negative_chk',
      sql`${table.sortOrder} >= 0`,
    ),
    check(
      'user_level_rule_daily_topic_limit_non_negative_chk',
      sql`${table.dailyTopicLimit} >= 0`,
    ),
    check(
      'user_level_rule_daily_reply_comment_limit_non_negative_chk',
      sql`${table.dailyReplyCommentLimit} >= 0`,
    ),
    check(
      'user_level_rule_post_interval_non_negative_chk',
      sql`${table.postInterval} >= 0`,
    ),
    check(
      'user_level_rule_daily_like_limit_non_negative_chk',
      sql`${table.dailyLikeLimit} >= 0`,
    ),
    check(
      'user_level_rule_daily_favorite_limit_non_negative_chk',
      sql`${table.dailyFavoriteLimit} >= 0`,
    ),
    check(
      'user_level_rule_purchase_payable_rate_range_chk',
      sql`${table.purchasePayableRate} >= 0 and ${table.purchasePayableRate} <= 1`,
    ),
    check(
      'user_level_rule_business_trimmed_not_blank_chk',
      sql`${table.business} is null or (${table.business} = btrim(${table.business}) and ${table.business} <> '')`,
    ),
  ],
)

export type UserLevelRuleSelect = typeof userLevelRule.$inferSelect
export type UserLevelRuleInsert = typeof userLevelRule.$inferInsert
