import type { UserComment } from '@db/schema'

/**
 * 用户资产汇总查询入参。
 * - 使用用户ID作为唯一查询条件
 */
export type UserAssetsSummaryQueryInput = Pick<UserComment, 'userId'>

/**
 * 聚合计数查询返回结构。
 * - 用于 count(*)::int 结果映射
 */
export interface UserAssetsCountRow {
  count: number
}

/**
 * 去重作品计数查询返回结构。
 * - 用于 COUNT(DISTINCT workId)::bigint 结果映射
 */
export interface UserAssetsDistinctWorkCountRow {
  total: bigint
}

/**
 * 用户资产汇总结果。
 * - 聚合评论、点赞、收藏、浏览、购买、下载等统计
 */
export interface UserAssetsSummary {
  purchasedWorkCount: number
  purchasedChapterCount: number
  downloadedWorkCount: number
  downloadedChapterCount: number
  favoriteCount: number
  likeCount: number
  viewCount: number
  commentCount: number
}
