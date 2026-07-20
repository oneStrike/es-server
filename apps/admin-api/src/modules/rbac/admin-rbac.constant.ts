/**
 * 管理端菜单类型。
 */
export enum AdminMenuType {
  /**
   * 目录节点。
   */
  CATALOG = 1,
  /**
   * 可访问菜单节点。
   */
  MENU = 2,
}

/**
 * 管理端权限来源。
 */
export enum AdminPermissionSource {
  /**
   * 后端接口装饰器同步。
   */
  API = 1,
}

/**
 * RBAC revision 单例行编码。
 */
export const ADMIN_RBAC_REVISION_CODE = 'global'

/**
 * 普通管理员登录后必须保留的基础权限。
 */
export const ADMIN_BASELINE_PERMISSION_CODES = [
  // 当前管理员个人资料查询。
  'system:user:profile',
  // 当前管理员个人资料更新。
  'system:user:profile:update',
  // 当前管理员修改密码。
  'system:user:password:change',
  // 当前管理员菜单树查询。
  'system:menu:current',
] as const
