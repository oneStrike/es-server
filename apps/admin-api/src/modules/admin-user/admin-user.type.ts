import type { AdminUserSelect } from '@db/schema'

/** 管理员账号响应行，不包含密码等敏感字段。 */
export type AdminUserResponseRow = Omit<AdminUserSelect, 'password'>

/** 管理员账号安全更新只需要账号 id 和启用状态。 */
export type AdminUserSafeUpdateTarget = Pick<
  AdminUserSelect,
  'id' | 'isEnabled'
>

/** 当前管理员自助资料更新只允许写入公开资料字段。 */
export type AdminUserProfileUpdateData = Partial<
  Pick<AdminUserSelect, 'username' | 'mobile' | 'avatar'>
>
