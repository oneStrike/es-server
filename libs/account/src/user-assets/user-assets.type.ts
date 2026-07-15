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
