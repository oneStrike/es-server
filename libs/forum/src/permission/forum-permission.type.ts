import type { ForumSectionSelect, UserLevelRuleSelect } from '@db/schema'

/**
 * 板块访问拒绝原因码。
 * 用于稳定映射异常语义，避免通过中文提示文案反推错误类型。
 */
export type ForumSectionAccessDeniedCode =
  | 'SECTION_UNAVAILABLE'
  | 'LOGIN_REQUIRED'
  | 'USER_DISABLED'
  | 'LEVEL_REQUIRED'

/**
 * 发帖权限校验使用的用户上下文。
 * 包含用户状态、经验值以及发帖频控所需的等级规则字段。
 */
/** 稳定领域类型 `ForumPostingUserContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ForumPostingUserContext
  extends Pick<
    {
      id: number
      isEnabled: boolean
      status: number
      experience: number
    },
    'id' | 'isEnabled' | 'status' | 'experience'
  > {
  level: Pick<UserLevelRuleSelect, 'dailyTopicLimit' | 'postInterval'> | null
}

/**
 * 板块访问权限上下文。
 * 既包含板块基础信息，也包含关联等级规则要求的经验值。
 */
/** 稳定领域类型 `ForumSectionPermissionContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ForumSectionPermissionContext
  extends Pick<
    ForumSectionSelect,
    | 'id'
    | 'groupId'
    | 'deletedAt'
    | 'name'
    | 'isEnabled'
    | 'topicReviewPolicy'
    | 'userLevelRuleId'
  > {
  requiredExperience: number | null
  isPubliclyAvailable: boolean
}

/**
 * 访问板块时使用的用户上下文。
 * 只关心用户是否可用以及当前经验值。
 */
/** 稳定领域类型 `ForumAccessUserContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ForumAccessUserContext {
  id: number
  isEnabled: boolean
  experience: number
}

/**
 * 板块访问状态。
 * 用于应用侧列表展示“可见但不可访问”时的前端提示。
 */
/** 稳定领域类型 `ForumSectionAccessState`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ForumSectionAccessState {
  canAccess: boolean
  requiredExperience: number | null
  accessDeniedCode?: ForumSectionAccessDeniedCode
  accessDeniedReason?: string
}
