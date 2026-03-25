import type { UserFavorite } from '@db/schema'
import type { FavoriteTargetTypeEnum } from './favorite.constant'

/**
 * 收藏目标入参。
 * - 统一约束目标类型与目标ID组合
 */
export type FavoriteTargetInput = Pick<UserFavorite, 'targetId'> & {
  targetType: FavoriteTargetTypeEnum
}

/**
 * 收藏记录入参。
 * - 在目标入参基础上补齐用户ID
 */
export type FavoriteRecordInput = FavoriteTargetInput &
  Pick<UserFavorite, 'userId'>

/**
 * 用户收藏分页查询入参。
 * - 以用户ID为主
 * - 分页参数与 PageDto 语义保持一致
 */
export type FavoritePageQuery = Pick<UserFavorite, 'userId'> & {
  pageIndex?: number
  pageSize?: number
}
