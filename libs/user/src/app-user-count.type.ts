/**
 * app_user_count 可原子更新的计数字段名。
 * 用于限制计数变更只能落在受支持的聚合列上。
 */
/** 稳定领域类型 `AppUserCountField`。仅供内部领域/服务链路复用，避免重复定义。 */
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
/** 稳定领域类型 `AppUserFollowingCountAggregation`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface AppUserFollowingCountAggregation {
  followingUserCount: number
  followingAuthorCount: number
  followingSectionCount: number
}

/**
 * 基于事实表重建后的完整用户计数读模型。
 * 用于 upsert app_user_count 前后的稳定聚合结构。
 */
/** 稳定领域类型 `RebuiltAppUserCountResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface RebuiltAppUserCountResult {
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
