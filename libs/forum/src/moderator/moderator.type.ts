import type {
  ForumModerator,
  ForumModeratorSection,
} from '@db/schema'
import type {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from './moderator.constant'

/**
 * 创建版主的领域输入。
 * 由 controller DTO 映射而来，service 不直接依赖 DTO。
 */
export type CreateForumModeratorInput = Pick<
  ForumModerator,
  'userId' | 'roleType'
> & {
  groupId?: number | null
  isEnabled?: boolean
  remark?: string
  permissions?: ForumModeratorPermissionEnum[]
  sectionIds?: number[]
}

/**
 * 更新版主的领域输入。
 * 支持调整角色、权限、分组和板块范围。
 */
export type UpdateForumModeratorInput = Pick<ForumModerator, 'id'> &
  Partial<
    Pick<
      ForumModerator,
      'groupId' | 'roleType' | 'isEnabled' | 'remark'
    >
  > & {
    permissions?: ForumModeratorPermissionEnum[]
    sectionIds?: number[]
  }

/**
 * 版主板块分配的领域输入。
 * 仅用于板块版主的作用域同步。
 */
export interface AssignForumModeratorSectionInput {
  moderatorId: number
  sectionIds: number[]
  permissions?: ForumModeratorPermissionEnum[]
}

/**
 * 版主分页查询条件。
 */
export interface QueryForumModeratorInput {
  userId?: number
  isEnabled?: boolean
  nickname?: string
  sectionId?: number
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

/**
 * 版主板块视图项。
 * 包含板块基础信息与最终生效权限。
 */
export interface ForumModeratorSectionView {
  id: number
  name: string
  inheritFromParent: boolean
  customPermissions: ForumModeratorPermissionEnum[]
  finalPermissions: ForumModeratorPermissionEnum[]
}

/**
 * 版主管理组简要信息。
 */
export interface ForumModeratorGroupView {
  id: number
  name: string
}

/**
 * 版主详情视图。
 * 供 admin controller 直接返回。
 */
export interface ForumModeratorView
  extends Pick<
    ForumModerator,
    'id' | 'userId' | 'roleType' | 'isEnabled' | 'createdAt' | 'updatedAt'
  > {
  groupId?: number
  permissions: ForumModeratorPermissionEnum[]
  remark?: string
  nickname: string
  avatar?: string
  permissionNames: string[]
  sections: ForumModeratorSectionView[]
  group?: ForumModeratorGroupView
}

/**
 * 版主板块关联的最小行结构。
 */
export type ForumModeratorSectionScope = Pick<
  ForumModeratorSection,
  'sectionId' | 'permissions'
>

/**
 * 角色作用域归一化结果。
 * 用于写路径里统一处理权限、分组与板块绑定。
 */
export interface NormalizedModeratorScope {
  roleType: ForumModeratorRoleTypeEnum
  groupId: number | null
  permissions: ForumModeratorPermissionEnum[]
  sectionIds: number[]
}
