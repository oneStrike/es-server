/**
 * 管理员角色枚举
 */
export enum UserRoleEnum {
  /** 普通管理员 */
  NORMAL_ADMIN = 0,

  /** 超级管理员 */
  SUPER_ADMIN = 1,
}

/**
 * 固定排除的用户信息字段
 */
export const EXCLUDE_USER_FIELDS = {
  /** 密码字段 */
  password: true,
}
