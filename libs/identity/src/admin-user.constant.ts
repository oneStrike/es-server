/**
 * 管理员角色枚举。
 * 归属 admin_user 领域，供后台账号权限与 DTO 契约复用。
 */
export enum AdminUserRoleEnum {
  /** 普通管理员 */
  NORMAL_ADMIN = 0,
  /** 超级管理员 */
  SUPER_ADMIN = 1,
}
