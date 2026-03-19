import type { UserBadgeTypeEnum } from './user-badge.constant'

/**
 * 徽章创建入参。
 * 对应 userBadge 的业务可写字段。
 */
export interface CreateUserBadgeInput {
  name: string
  description?: string
  icon?: string
  business?: string
  eventKey?: string
  type: UserBadgeTypeEnum
  sortOrder: number
  isEnabled: boolean
}

/**
 * 徽章更新入参。
 * 包含目标徽章 id 与完整可写字段。
 */
export interface UpdateUserBadgeInput extends CreateUserBadgeInput {
  id: number
}

/**
 * 徽章状态更新入参。
 * 仅用于切换 isEnabled 状态。
 */
export interface UpdateUserBadgeStatusInput {
  id: number
  isEnabled: boolean
}

/**
 * 徽章分页查询条件。
 * 用于按名称、类型、状态等维度筛选徽章。
 */
export interface QueryUserBadgePageInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  name?: string
  type?: UserBadgeTypeEnum
  isEnabled?: boolean
  business?: string
  eventKey?: string
}

/**
 * 用户徽章指派入参。
 * 用于管理员为用户授予或撤销徽章。
 */
export interface AssignUserBadgeInput {
  badgeId: number
  userId: number
}
