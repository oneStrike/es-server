import type { Db } from '@db/core'

export type ForumSectionCountField =
  | 'topicCount'
  | 'commentCount'
  | 'followersCount'

export type ForumTopicCountField = 'viewCount' | 'likeCount' | 'favoriteCount'

export type ForumCounterMutationResult =
  | { rowCount?: number | null }
  | unknown[]

export type ForumCounterMutationOperation = (
  client: Db,
) => Promise<ForumCounterMutationResult>
