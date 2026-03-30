import type { AppUserCountSelect } from '@db/schema'
import type { UserStatusEnum } from '@libs/platform/constant'

/**
 * 用户资料分页查询条件。
 * 对应 admin 侧用户资料列表筛选。
 */
export interface QueryUserProfileListInput {
  nickname?: string
  levelId?: number
  status?: UserStatusEnum
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  startDate?: string
  endDate?: string
}

/**
 * 更新用户状态的领域输入。
 * 用户状态信息落在 app_user，userId 复用 app_user_count 主键语义。
 */
export type UpdateUserStatusInput = Pick<AppUserCountSelect, 'userId'> & {
  status: UserStatusEnum
  banReason?: string
  banUntil?: Date
}
