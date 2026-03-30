import type { ForumSectionGroupSelect } from '@db/schema'

/**
 * 创建板块分组的领域输入。
 */
export type CreateForumSectionGroupInput = Pick<ForumSectionGroupSelect, 'name'> &
  Partial<
    Pick<ForumSectionGroupSelect, 'description' | 'sortOrder' | 'isEnabled'>
  >

/**
 * 更新板块分组的领域输入。
 */
export type UpdateForumSectionGroupInput = Pick<ForumSectionGroupSelect, 'id'> &
  Partial<
    Pick<
      ForumSectionGroupSelect,
      'name' | 'description' | 'sortOrder' | 'isEnabled'
    >
  >

/**
 * 分页查询板块分组的条件。
 */
export interface QueryForumSectionGroupInput {
  name?: string
  isEnabled?: boolean
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

/**
 * 应用侧查询板块分组可见列表的条件。
 * 基于当前用户上下文补充分组内板块的访问状态信息。
 */
export interface QueryPublicForumSectionGroupInput {
  userId?: number
}

/**
 * 更新板块分组启用状态的领域输入。
 */
export interface UpdateForumSectionGroupEnabledInput {
  id: number
  isEnabled: boolean
}

/**
 * 交换板块分组排序的领域输入。
 */
export interface SwapForumSectionGroupSortInput {
  dragId: number
  targetId: number
}
