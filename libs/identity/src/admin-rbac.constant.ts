/**
 * 管理端系统内置角色编码。
 */
export enum AdminSystemRoleCode {
  NORMAL_ADMIN = 'normal_admin',
  SUPER_ADMIN = 'super_admin',
}

/**
 * 管理端菜单类型。
 */
export enum AdminMenuType {
  CATALOG = 'catalog',
  MENU = 'menu',
}

/**
 * 管理端权限来源。
 */
export enum AdminPermissionSource {
  API = 'api',
}

/**
 * RBAC revision 单例行编码。
 */
export const ADMIN_RBAC_REVISION_CODE = 'global'

/**
 * 普通管理员登录后必须保留的基础权限。
 */
export const ADMIN_BASELINE_PERMISSION_CODES = [
  'system:user:profile',
  'system:user:profile:update',
  'system:user:password:change',
  'system:menu:current',
] as const
