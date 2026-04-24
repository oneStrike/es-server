/**
 * app_user_count 可原子更新的计数字段名。
 * 用于限制计数变更只能落在受支持的聚合列上。
 */
export type AppUserCountField =
  | 'commentCount'
  | 'likeCount'
  | 'favoriteCount'
  | 'followingUserCount'
  | 'followingAuthorCount'
  | 'followingSectionCount'
  | 'followersCount'
  | 'forumTopicCount'
  | 'commentReceivedLikeCount'
  | 'forumTopicReceivedLikeCount'
  | 'forumTopicReceivedFavoriteCount'

/**
 * 用户主动关注出去的分项聚合结果。
 * 仅覆盖 following 维度，不包含 followersCount。
 */
export interface AppUserFollowingCountAggregation {
  followingUserCount: number
  followingAuthorCount: number
  followingSectionCount: number
}

/**
 * 用户计数读模型快照。
 * 供读取、修复和重建 `app_user_count` 的服务链路复用统一结构。
 */
export interface AppUserCountSnapshot {
  userId: number
  commentCount: number
  likeCount: number
  favoriteCount: number
  followingUserCount: number
  followingAuthorCount: number
  followingSectionCount: number
  followersCount: number
  forumTopicCount: number
  commentReceivedLikeCount: number
  forumTopicReceivedLikeCount: number
  forumTopicReceivedFavoriteCount: number
}
