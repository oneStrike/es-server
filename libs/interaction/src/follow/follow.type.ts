import type { AppUser, UserFollow } from '@db/schema'
import type { FollowTargetTypeEnum } from './follow.constant'

/**
 * 关注目标入参。
 * - 统一约束目标类型与目标 ID 组合
 */
export type FollowTargetInput = Pick<UserFollow, 'targetId'> & {
  targetType: FollowTargetTypeEnum
}

/**
 * 关注记录入参。
 * - 在目标入参基础上补齐发起关注的用户 ID
 */
export type FollowRecordInput = FollowTargetInput & Pick<UserFollow, 'userId'>

/**
 * 用户关注分页查询入参。
 * - 以当前用户为主
 */
export type FollowPageQuery = Pick<UserFollow, 'userId'> & {
  pageIndex?: number
  pageSize?: number
}

/**
 * 用户关注/互关状态视图。
 * - isFollowing 表示当前用户是否已关注目标
 * - isFollowedByTarget 仅对 USER 目标有意义
 */
export interface FollowStatusView {
  isFollowing: boolean
  isFollowedByTarget: boolean
  isMutualFollow: boolean
}

/**
 * 用户卡片视图。
 * - 用于关注列表、粉丝列表等轻量用户展示
 */
export interface FollowUserCardView
  extends Pick<AppUser, 'id' | 'nickname' | 'avatarUrl' | 'signature'> {
  followingUserCount: number
  followingAuthorCount: number
  followingSectionCount: number
  followersCount: number
}

/**
 * 用户关注列表项视图。
 * - 复用 user_follow 事实表字段，并补充用户详情与关系状态
 */
export interface FollowUserPageItemView
  extends Pick<UserFollow, 'id' | 'userId' | 'targetType' | 'targetId' | 'createdAt'>,
    FollowStatusView {
  user?: FollowUserCardView
}
