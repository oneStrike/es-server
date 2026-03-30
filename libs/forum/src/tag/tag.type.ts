import type { ForumTagSelect } from '@db/schema'

/**
 * 创建论坛标签的领域输入。
 */
export type CreateForumTagInput = Pick<ForumTagSelect, 'name'> &
  Partial<Pick<ForumTagSelect, 'icon' | 'description' | 'sortOrder' | 'isEnabled'>>

/**
 * 更新论坛标签的领域输入。
 */
export type UpdateForumTagInput = Pick<ForumTagSelect, 'id'> &
  Partial<
    Pick<ForumTagSelect, 'name' | 'icon' | 'description' | 'sortOrder' | 'isEnabled'>
  >

/**
 * 分页查询论坛标签的条件。
 */
export interface QueryForumTagInput {
  name?: string
  isEnabled?: boolean
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

/**
 * 为主题分配标签的领域输入。
 */
export interface AssignForumTagToTopicInput {
  topicId: number
  tagId: number
}

/**
 * 从主题移除标签的领域输入。
 */
export interface RemoveForumTagFromTopicInput {
  topicId: number
  tagId: number
}
