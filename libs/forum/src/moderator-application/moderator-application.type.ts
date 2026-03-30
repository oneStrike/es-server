import type { ForumModeratorApplicationSelect } from '@db/schema'
import type { ForumModeratorPermissionEnum } from '../moderator'
import type { ForumModeratorApplicationStatusEnum } from './moderator-application.constant'

/**
 * 创建版主申请的领域输入。
 */
export type CreateForumModeratorApplicationInput = Pick<
  ForumModeratorApplicationSelect,
  'sectionId' | 'reason'
> & {
  remark?: string
  permissions?: ForumModeratorPermissionEnum[]
}

/**
 * 查询版主申请的条件。
 */
export interface QueryForumModeratorApplicationInput {
  applicantId?: number
  sectionId?: number
  status?: ForumModeratorApplicationStatusEnum
  nickname?: string
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

/**
 * 审核版主申请的领域输入。
 */
export type AuditForumModeratorApplicationInput = Pick<
  ForumModeratorApplicationSelect,
  'id'
> & {
  status: ForumModeratorApplicationStatusEnum
  auditReason?: string
  remark?: string
}
