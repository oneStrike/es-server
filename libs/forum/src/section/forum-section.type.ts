import type { ForumSectionSelect } from '@db/schema'

export type ForumSectionBatchHandler = (batchIds: number[]) => Promise<void>

export interface ForumVisibleSectionQueryOptions {
  groupId?: number
  isUngrouped?: boolean
  sectionIds?: number[]
}

export interface ForumVisibleSectionGroupRow {
  id: number
  name: string
  description: string | null
  sortOrder: number
  isEnabled: boolean
  deletedAt: Date | null
}

export type ForumVisibleSectionRow = Pick<
  ForumSectionSelect,
  | 'id'
  | 'groupId'
  | 'userLevelRuleId'
  | 'deletedAt'
  | 'name'
  | 'description'
  | 'icon'
  | 'cover'
  | 'sortOrder'
  | 'isEnabled'
  | 'topicReviewPolicy'
  | 'topicCount'
  | 'commentCount'
  | 'followersCount'
  | 'lastPostAt'
> & {
  group?: ForumVisibleSectionGroupRow | null
}
