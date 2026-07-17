import type { ForumSectionSelect } from '@db/schema'

export type ForumSectionBatchHandler = (batchIds: number[]) => Promise<void>

/** 完整性锁获取前发现、锁后复核的板块引用快照。 */
export type ForumSectionMutationSnapshot = Pick<
  ForumSectionSelect,
  'groupId' | 'id' | 'userLevelRuleId'
>

/** 作品托管板块的完整性锁计划事实。 */
export type ManagedForumSectionMutationSnapshot =
  ForumSectionMutationSnapshot & {
    workId: number
  }

/** 作品托管板块同步允许写入的闭集字段。 */
export type ManagedForumSectionUpdatePayload = Partial<
  Pick<ForumSectionSelect, 'description' | 'isEnabled' | 'name'>
>

/** 管理端板块更新允许写入的闭集字段。 */
export type ForumSectionUpdatePayload = Partial<
  Pick<
    ForumSectionSelect,
    | 'cover'
    | 'description'
    | 'groupId'
    | 'icon'
    | 'isEnabled'
    | 'name'
    | 'remark'
    | 'sortOrder'
    | 'topicReviewPolicy'
    | 'userLevelRuleId'
  >
>

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
