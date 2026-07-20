import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  primaryKey,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 管理端系统内置角色编码。
 */
export enum AdminSystemRoleCode {
  /**
   * 普通管理员角色。
   */
  NORMAL_ADMIN = 'normal_admin',
  /**
   * 超级管理员角色。
   */
  SUPER_ADMIN = 'super_admin',
}

/**
 * 管理端角色。
 */
export const adminRole = snakeCase.table(
  'admin_role',
  {
    /**
     * 主键id
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 角色编码
     */
    code: varchar({ length: 80 }).notNull(),
    /**
     * 角色名称
     */
    name: varchar({ length: 80 }).notNull(),
    /**
     * 角色说明
     */
    description: varchar({ length: 300 }),
    /**
     * 是否系统内置角色
     */
    isSystem: boolean().default(false).notNull(),
    /**
     * 是否启用
     */
    isEnabled: boolean().default(true).notNull(),
    /**
     * 排序值
     */
    sortOrder: integer().default(0).notNull(),
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
    unique('admin_role_code_key').on(table.code),
    index('admin_role_is_enabled_idx').on(table.isEnabled),
    index('admin_role_sort_order_idx').on(table.sortOrder),
    check(
      'admin_role_code_not_blank_chk',
      sql`length(trim(${table.code})) > 0`,
    ),
  ],
)

/**
 * 管理端接口权限。
 */
export const adminPermission = snakeCase.table(
  'admin_permission',
  {
    /**
     * 主键id
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 权限编码，由后端代码装饰器定义
     */
    code: varchar({ length: 160 }).notNull(),
    /**
     * 权限名称
     */
    name: varchar({ length: 120 }).notNull(),
    /**
     * 权限分组编码
     */
    groupCode: varchar({ length: 120 }).notNull(),
    /**
     * 权限说明
     */
    description: varchar({ length: 300 }),
    /**
     * 权限来源（1=后端接口装饰器同步）
     */
    source: smallint().default(1).notNull(),
    /**
     * 是否启用
     */
    isEnabled: boolean().default(true).notNull(),
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
    unique('admin_permission_code_key').on(table.code),
    index('admin_permission_group_code_idx').on(table.groupCode),
    index('admin_permission_is_enabled_idx').on(table.isEnabled),
    check(
      'admin_permission_code_not_blank_chk',
      sql`length(trim(${table.code})) > 0`,
    ),
    check('admin_permission_source_chk', sql`${table.source} in (1)`),
  ],
)

/**
 * 管理端菜单。
 */
export const adminMenu = snakeCase.table(
  'admin_menu',
  {
    /**
     * 主键id
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 菜单编码
     */
    code: varchar({ length: 120 }).notNull(),
    /**
     * 父级菜单id
     */
    parentId: integer(),
    /**
     * 菜单类型（1=目录，2=菜单）
     */
    type: smallint().default(2).notNull(),
    /**
     * 菜单标题
     */
    title: varchar({ length: 80 }).notNull(),
    /**
     * 路由路径
     */
    path: varchar({ length: 200 }).notNull(),
    /**
     * 路由名称
     */
    name: varchar({ length: 120 }),
    /**
     * 前端组件键
     */
    component: varchar({ length: 240 }),
    /**
     * 重定向路径
     */
    redirect: varchar({ length: 200 }),
    /**
     * 图标
     */
    icon: varchar({ length: 80 }),
    /**
     * 排序值
     */
    sortOrder: integer().default(0).notNull(),
    /**
     * 是否显示
     */
    isVisible: boolean().default(true).notNull(),
    /**
     * 是否启用
     */
    isEnabled: boolean().default(true).notNull(),
    /**
     * 是否缓存页面
     */
    keepAlive: boolean().default(false).notNull(),
    /**
     * 外链地址
     */
    externalLink: varchar({ length: 300 }),
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
    unique('admin_menu_code_key').on(table.code),
    index('admin_menu_parent_sort_idx').on(table.parentId, table.sortOrder),
    index('admin_menu_is_enabled_idx').on(table.isEnabled),
    check('admin_menu_type_chk', sql`${table.type} in (1, 2)`),
    check(
      'admin_menu_code_not_blank_chk',
      sql`length(trim(${table.code})) > 0`,
    ),
  ],
)

/**
 * 管理端角色权限关系。
 */
export const adminRolePermission = snakeCase.table(
  'admin_role_permission',
  {
    /**
     * 角色id
     */
    roleId: integer().notNull(),
    /**
     * 权限id
     */
    permissionId: integer().notNull(),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.roleId, table.permissionId],
      name: 'admin_role_permission_pkey',
    }),
    index('admin_role_permission_role_id_idx').on(table.roleId),
    index('admin_role_permission_permission_id_idx').on(table.permissionId),
  ],
)

/**
 * 管理端角色菜单关系。
 */
export const adminRoleMenu = snakeCase.table(
  'admin_role_menu',
  {
    /**
     * 角色id
     */
    roleId: integer().notNull(),
    /**
     * 菜单id
     */
    menuId: integer().notNull(),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.roleId, table.menuId],
      name: 'admin_role_menu_pkey',
    }),
    index('admin_role_menu_role_id_idx').on(table.roleId),
    index('admin_role_menu_menu_id_idx').on(table.menuId),
  ],
)

/**
 * 管理端用户角色关系。
 */
export const adminUserRole = snakeCase.table(
  'admin_user_role',
  {
    /**
     * 管理员用户id
     */
    adminUserId: integer().notNull(),
    /**
     * 角色id
     */
    roleId: integer().notNull(),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.adminUserId, table.roleId],
      name: 'admin_user_role_pkey',
    }),
    index('admin_user_role_admin_user_id_idx').on(table.adminUserId),
    index('admin_user_role_role_id_idx').on(table.roleId),
  ],
)

/**
 * 管理端 RBAC 全局版本。
 */
export const adminRbacRevision = snakeCase.table('admin_rbac_revision', {
  /**
   * 单例编码
   */
  code: varchar({ length: 30 }).primaryKey(),
  /**
   * 当前权限版本
   */
  revision: integer().default(1).notNull(),
  /**
   * 默认菜单完成首次种子的时间；菜单配置之后由后台配置权威维护。
   */
  menuSeededAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export type AdminRoleSelect = typeof adminRole.$inferSelect
export type AdminRoleInsert = typeof adminRole.$inferInsert
export type AdminPermissionSelect = typeof adminPermission.$inferSelect
export type AdminPermissionInsert = typeof adminPermission.$inferInsert
export type AdminMenuSelect = typeof adminMenu.$inferSelect
export type AdminMenuInsert = typeof adminMenu.$inferInsert
