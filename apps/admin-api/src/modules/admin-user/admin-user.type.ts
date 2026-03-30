import type { AdminUserSelect } from '@db/schema'

/**
 * 管理端用户分页查询入参。
 * 用于管理员列表分页与基础筛选。
 */
export interface AdminUserPageQueryInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  username?: AdminUserSelect['username']
  mobile?: AdminUserSelect['mobile']
  isEnabled?: AdminUserSelect['isEnabled']
  role?: AdminUserSelect['role']
}

/**
 * 管理端用户修改密码入参。
 * 仅用于当前管理员自助修改密码时的三段式校验。
 */
export interface AdminUserChangePasswordInput {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}
