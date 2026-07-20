import type { AdminUserSelect } from '@db/schema'

/** 管理端登录链路所需的最小凭据视图。 */
export type AdminLoginUserSource = Pick<
  AdminUserSelect,
  | 'id'
  | 'username'
  | 'password'
  | 'mobile'
  | 'avatar'
  | 'isEnabled'
  | 'lastLoginAt'
  | 'lastLoginIp'
  | 'createdAt'
  | 'updatedAt'
>

/** 管理端会话刷新和状态守卫共用的最小账号状态。 */
export type AdminUserStatusSource = Pick<AdminUserSelect, 'id' | 'isEnabled'>
