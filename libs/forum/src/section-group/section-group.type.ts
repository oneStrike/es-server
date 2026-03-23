import type { ForumSectionGroup } from '@db/schema'

/**
 * 创建板块分组的领域输入。
 */
export type CreateForumSectionGroupInput = Pick<ForumSectionGroup, 'name'> &
  Partial<
    Pick<ForumSectionGroup, 'description' | 'sortOrder' | 'isEnabled'>
  >

/**
 * 更新板块分组的领域输入。
 */
export type UpdateForumSectionGroupInput = Pick<ForumSectionGroup, 'id'> &
  Partial<
    Pick<
      ForumSectionGroup,
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
 * 应用侧查询公开板块分组列表的条件。
 * 仅依赖当前用户上下文过滤可访问板块。
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
