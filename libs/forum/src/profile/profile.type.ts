import type { ForumProfile } from '@db/schema'
import type { UserStatusEnum } from '@libs/platform/constant'

/**
 * 论坛画像分页查询条件。
 * 对应 admin 侧用户论坛资料列表筛选。
 */
export interface QueryForumProfileListInput {
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
 * 更新论坛用户状态的领域输入。
 * 用户状态信息落在 app_user，userId 复用 forum_profile 关联主键语义。
 */
export type UpdateForumProfileStatusInput = Pick<ForumProfile, 'userId'> & {
  status: UserStatusEnum
  banReason?: string
  banUntil?: Date
}
