import type { ForumSection } from '@db/schema'

/**
 * 创建论坛板块的领域输入。
 * 仅包含写路径真正允许落库的字段。
 */
export type CreateForumSectionInput = Pick<ForumSection, 'name'> &
  Partial<
    Pick<
      ForumSection,
      | 'groupId'
      | 'userLevelRuleId'
      | 'icon'
      | 'sortOrder'
      | 'isEnabled'
      | 'topicReviewPolicy'
      | 'description'
    >
  >

/**
 * 更新论坛板块的领域输入。
 * 支持部分更新板块基础配置。
 */
export type UpdateForumSectionInput = Pick<ForumSection, 'id'> &
  Partial<
    Pick<
      ForumSection,
      | 'name'
      | 'groupId'
      | 'userLevelRuleId'
      | 'icon'
      | 'sortOrder'
      | 'isEnabled'
      | 'topicReviewPolicy'
      | 'description'
    >
  >

/**
 * 分页查询论坛板块的条件。
 */
export interface QueryForumSectionInput {
  name?: string
  isEnabled?: boolean
  topicReviewPolicy?: number
  groupId?: number
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

/**
 * 应用侧查询公开板块列表的条件。
 * 支持按分组筛选，并根据当前用户过滤可访问板块。
 */
export interface QueryPublicForumSectionInput {
  groupId?: number
  userId?: number
}

/**
 * 更新板块启用状态的领域输入。
 */
export interface UpdateForumSectionEnabledInput {
  id: number
  isEnabled: boolean
}

/**
 * 交换板块排序的领域输入。
 */
export interface SwapForumSectionSortInput {
  dragId: number
  targetId: number
}
