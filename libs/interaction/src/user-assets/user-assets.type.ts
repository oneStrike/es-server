/**
 * 聚合计数查询返回结构。
 * - 用于 count(*)::int 结果映射
 */
/** 稳定领域类型 `UserAssetsCountRow`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface UserAssetsCountRow {
  count: number
}

/**
 * 去重作品计数查询返回结构。
 * - 用于 COUNT(DISTINCT workId)::bigint 结果映射
 */
/** 稳定领域类型 `UserAssetsDistinctWorkCountRow`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface UserAssetsDistinctWorkCountRow {
  total: bigint
}

/**
 * 用户资产汇总结果。
 * - 聚合评论、点赞、收藏、浏览、购买、下载等统计
 */
/** 稳定领域类型 `UserAssetsSummary`。仅供内部领域/服务链路复用，避免重复定义。 */
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
