/**
 * 聚合计数查询返回结构，仅供用户资产服务 count(*)::int 结果映射复用。
 */
export interface UserAssetsCountRow {
  count: number
}

/**
 * 去重作品计数查询返回结构，仅供用户资产服务 COUNT(DISTINCT workId)::bigint 结果映射复用。
 */
export interface UserAssetsDistinctWorkCountRow {
  total: bigint
}

/**
 * 用户资产汇总结果，聚合钱包、VIP、券、互动、购买和下载统计。
 */
export interface UserAssetsSummary {
  currencyBalance: number
  vipExpiresAt: Date | null
  availableCouponCount: number
  purchasedWorkCount: number
  purchasedChapterCount: number
  downloadedWorkCount: number
  downloadedChapterCount: number
  favoriteCount: number
  likeCount: number
  viewCount: number
  commentCount: number
}
