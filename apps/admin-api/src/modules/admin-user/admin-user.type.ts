import type { AdminUserSelect } from '@db/schema'

/** 管理员账号响应映射统一复用 schema 推导类型。 */
export type AdminUserResponseRow = AdminUserSelect

/** 管理员账号安全更新只需要账号 id 和启用状态。 */
export type AdminUserSafeUpdateTarget = Pick<
  AdminUserSelect,
  'id' | 'isEnabled'
>
