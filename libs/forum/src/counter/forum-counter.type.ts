import type { Db } from '@db/core'

/**
 * forum_section 可维护的计数字段名。
 * 仅供 ForumCounterService 约束板块冗余计数更新入口使用。
 */
export type ForumSectionCountField =
  | 'topicCount'
  | 'commentCount'
  | 'followersCount'

/**
 * forum_topic 可维护的计数字段名。
 * 仅供 ForumCounterService 约束主题冗余计数更新入口使用。
 */
export type ForumTopicCountField = 'viewCount' | 'likeCount' | 'favoriteCount'

/** 论坛计数写操作的 Drizzle 返回结果。 */
export type ForumCounterMutationResult =
  | { rowCount?: number | null }
  | unknown[]

/** 论坛计数写操作回调。 */
export type ForumCounterMutationOperation = (
  client: Db,
) => Promise<ForumCounterMutationResult>
