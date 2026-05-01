/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 应用用户表
 * 存储应用端用户信息及其关联关系
 */
export const appUser = snakeCase.table(
  'app_user',
  {
    /**
     * 用户ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 账号（唯一）
     */
    account: varchar({ length: 20 }).notNull(),
    /**
     * 手机号（唯一）
     */
    phoneNumber: varchar({ length: 20 }),
    /**
     * 邮箱（唯一）
     */
    emailAddress: varchar({ length: 255 }),
    /**
     * 等级ID
     */
    levelId: integer(),
    /**
     * 昵称
     */
    nickname: varchar({ length: 100 }).notNull(),
    /**
     * 密码（加密存储）
     */
    password: varchar({ length: 500 }).notNull(),
    /**
     * 头像URL
     */
    avatarUrl: varchar({ length: 500 }),
    /**
     * 个性签名
     */
    signature: varchar({ length: 200 }),
    /**
     * 个人简介
     */
    bio: varchar({ length: 500 }),
    /**
     * 是否启用
     */
    isEnabled: boolean().default(true).notNull(),
    /**
     * 性别（0=未知，1=男性，2=女性，3=其他，4=保密）
     */
    genderType: smallint().default(0).notNull(),
    /**
     * 出生日期
     */
    birthDate: date(),
    /**
     * 用户状态（1=正常，2=禁言，3=永久禁言，4=封禁，5=永久封禁）
     */
    status: smallint().default(1).notNull(),
    /**
     * 封禁原因
     */
    banReason: varchar({ length: 500 }),
    /**
     * 封禁到期时间
     */
    banUntil: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 最后登录时间
     */
    lastLoginAt: timestamp({ withTimezone: true }),
    /**
     * 最后登录IP
     */
    lastLoginIp: varchar({ length: 45 }),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    /**
     * 更新时间
     */
    updatedAt: timestamp({ withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
    /**
     * 删除时间（软删除）
     */
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    unique('app_user_account_key').on(table.account),
    unique('app_user_phone_number_key').on(table.phoneNumber),
    unique('app_user_email_address_key').on(table.emailAddress),
    index('app_user_is_enabled_idx').on(table.isEnabled),
    index('app_user_gender_type_idx').on(table.genderType),
    index('app_user_created_at_idx').on(table.createdAt),
    index('app_user_last_login_at_idx').on(table.lastLoginAt),
    index('app_user_phone_number_idx').on(table.phoneNumber),
    index('app_user_email_address_idx').on(table.emailAddress),
    index('app_user_status_idx').on(table.status),
    index('app_user_level_id_idx').on(table.levelId),
    index('app_user_deleted_at_idx').on(table.deletedAt),
    check(
      'app_user_gender_type_valid_chk',
      sql`${table.genderType} in (0, 1, 2, 3, 4)`,
    ),
    check('app_user_status_valid_chk', sql`${table.status} in (1, 2, 3, 4, 5)`),
  ],
)

/**
 * 应用用户推导类型
 */
export type AppUserSelect = typeof appUser.$inferSelect
export type AppUserInsert = typeof appUser.$inferInsert
