import type { AppUserSelect, ForumSectionSelect, UserLevelRuleSelect } from '@db/schema'

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
 * 复用 app_user 字段，并补充经验值与等级规则快照。
 */
export interface ForumPostingUserContext
  extends Pick<
    AppUserSelect,
    'id' | 'isEnabled' | 'status'
  > {
  experience: number
  level: Pick<UserLevelRuleSelect, 'dailyTopicLimit' | 'postInterval'> | null
}

/**
 * 板块访问权限上下文。
 * 既包含板块基础信息，也包含关联等级规则要求的经验值。
 */
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
export interface ForumAccessUserContext extends Pick<AppUserSelect, 'id' | 'isEnabled'> {
  experience: number
}

/**
 * 板块访问状态。
 * 用于应用侧列表展示“可见但不可访问”时的前端提示。
 */
export interface ForumSectionAccessState {
  canAccess: boolean
  requiredExperience: number | null
    accessDeniedCode?: ForumSectionAccessDeniedCode
  accessDeniedReason?: string
}

/** 板块分组可用性快照，用于公开可用性判断。 */
export interface SectionGroupAvailability {
  isEnabled: boolean
  deletedAt: Date | null
}

/** 板块公开可用性判断入参。 */
export type SectionPublicAvailabilityInput = Pick<
  ForumSectionPermissionContext,
  'groupId' | 'deletedAt' | 'isEnabled'
> & {
  group?: SectionGroupAvailability | null
}

/** 等级规则经验值快照，用于访问上下文构建。 */
export interface SectionLevelRuleExperience {
  requiredExperience: number
}

/** 板块访问上下文构建入参。 */
export type SectionAccessContextInput = Pick<
  ForumSectionPermissionContext,
  'groupId' | 'deletedAt' | 'isEnabled' | 'userLevelRuleId'
> & {
  group?: SectionGroupAvailability | null
  userLevelRule?: SectionLevelRuleExperience | null
}

/** 发帖用户经验引用，用于权限校验。 */
export type PostingUserExperienceRef = Pick<
  ForumPostingUserContext,
  'experience'
>
