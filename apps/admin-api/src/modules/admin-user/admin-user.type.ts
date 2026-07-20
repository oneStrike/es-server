import type { DbTransaction } from '@db/core'
import type { AdminUserSelect } from '@db/schema'

/** 管理员账号对外读取行，不包含密码等凭据字段。 */
export type AdminUserResponseSource = Omit<AdminUserSelect, 'password'>

/** 管理员账号安全更新只需要账号 id 和启用状态。 */
export type AdminUserSafeUpdateTarget = Pick<
  AdminUserSelect,
  'id' | 'isEnabled'
>

/** 更新管理员账号前需要读取的稳定字段。 */
export type AdminUserAccountForUpdateSource = AdminUserSafeUpdateTarget & {
  username: string
  mobile: string | null
}

/** 管理员账号可用性检查所需字段。 */
export interface AdminAccountAvailabilityInput {
  username?: string
  mobile?: string
}

/** 管理员账号创建事务入参。 */
export interface CreateAdminAccountInput {
  username: string
  password: string
  avatar?: string
  mobile?: string
}

/** 管理员账号域事务执行器。 */
export type AdminUserTransactionExecutor<T> = (
  tx: AdminUserAccountTransaction,
) => Promise<T>

/** 当前管理员自助资料允许写入的字段。 */
export type AdminUserProfileUpdateData = Partial<
  Pick<AdminUserSelect, 'username' | 'mobile' | 'avatar'>
>

/** 管理员账号域与 RBAC 领域协作时使用的事务上下文。 */
export type AdminUserAccountTransaction = DbTransaction

/** 管理员密码校验所需的最小凭据视图。 */
export type AdminPasswordCredentialSource = Pick<
  AdminUserSelect,
  'id' | 'password'
>
