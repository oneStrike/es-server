import type { ForumTopic } from '@db/schema'
import type { AuditStatusEnum } from '@libs/platform/constant'

/**
 * 创建论坛主题的领域输入。
 * 由 controller 侧 DTO 映射而来，service 不直接依赖 DTO。
 */
export type CreateForumTopicInput = Pick<
  ForumTopic,
  'sectionId' | 'userId' | 'title' | 'content'
>

/**
 * 更新论坛主题正文的领域输入。
 * 仅允许修改标题与内容，不允许迁移板块或变更发帖人。
 */
export type UpdateForumTopicInput = Pick<ForumTopic, 'id'> &
  Pick<ForumTopic, 'title' | 'content'>

/**
 * 后台分页查询论坛主题的条件。
 */
export interface QueryForumTopicInput {
  keyword?: string
  sectionId?: number
  userId?: number
  isPinned?: boolean
  isFeatured?: boolean
  isLocked?: boolean
  isHidden?: boolean
  auditStatus?: AuditStatusEnum
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

/**
 * app 侧分页查询公开主题的条件。
 */
export interface QueryPublicForumTopicInput {
  sectionId: number
  userId?: number
  pageIndex?: number
  pageSize?: number
}

export interface PublicForumTopicDetailContext {
  userId?: number
  ipAddress?: string
  device?: string
}

/**
 * 更新主题审核状态的领域输入。
 */
export type UpdateForumTopicAuditStatusInput = Pick<
  ForumTopic,
  'id' | 'auditStatus'
> & {
  auditReason?: string
}

/**
 * 更新主题置顶状态的领域输入。
 */
export type UpdateForumTopicPinnedInput = Pick<ForumTopic, 'id' | 'isPinned'>

/**
 * 更新主题精华状态的领域输入。
 */
export type UpdateForumTopicFeaturedInput = Pick<
  ForumTopic,
  'id' | 'isFeatured'
>

/**
 * 更新主题锁定状态的领域输入。
 */
export type UpdateForumTopicLockedInput = Pick<ForumTopic, 'id' | 'isLocked'>

/**
 * 更新主题隐藏状态的领域输入。
 */
export type UpdateForumTopicHiddenInput = Pick<ForumTopic, 'id' | 'isHidden'>
