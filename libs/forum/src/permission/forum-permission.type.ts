import type {
  AppUser,
  ForumSection,
  UserLevelRule,
} from '@db/schema'

/**
 * 发帖权限校验使用的用户上下文。
 * 包含用户状态、经验值以及发帖频控所需的等级规则字段。
 */
export interface ForumPostingUserContext
  extends Pick<AppUser, 'id' | 'isEnabled' | 'status' | 'experience'> {
  level: Pick<UserLevelRule, 'dailyTopicLimit' | 'postInterval'> | null
}

/**
 * 板块访问权限上下文。
 * 既包含板块基础信息，也包含关联等级规则要求的经验值。
 */
export interface ForumSectionPermissionContext
  extends Pick<
    ForumSection,
    'id' | 'name' | 'isEnabled' | 'topicReviewPolicy' | 'userLevelRuleId'
  > {
  requiredExperience: number | null
}

/**
 * 访问板块时使用的用户上下文。
 * 只关心用户是否可用以及当前经验值。
 */
export type ForumAccessUserContext = Pick<
  AppUser,
  'id' | 'isEnabled' | 'experience'
>
