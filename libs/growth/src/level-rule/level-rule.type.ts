import type { UserLevelRulePermissionEnum } from './level-rule.constant'

/**
 * 等级规则创建入参。
 * 对应 userLevelRule 的业务可写字段集合。
 */
export interface CreateUserLevelRuleInput {
  name: string
  description?: string
  icon?: string
  requiredExperience: number
  loginDays: number
  sortOrder: number
  business?: string | null
  isEnabled: boolean
  dailyTopicLimit: number
  dailyReplyCommentLimit: number
  postInterval: number
  dailyLikeLimit: number
  dailyFavoriteLimit: number
  blacklistLimit: number
  workCollectionLimit: number
  discount: string
  color?: string
  badge?: string
}

/**
 * 等级规则更新入参。
 * 使用局部更新语义，并带目标规则 id。
 */
export interface UpdateUserLevelRuleInput extends Partial<CreateUserLevelRuleInput> {
  id: number
}

/**
 * 等级规则分页查询条件。
 * 用于管理端规则筛选与分页。
 */
export interface QueryUserLevelRulePageInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  name?: string
  business?: string
  isEnabled?: boolean
}

/**
 * 等级权限检查入参。
 * 用于检查指定用户某类论坛权限是否可用。
 */
export interface CheckUserLevelPermissionInput {
  userId: number
  permissionType: UserLevelRulePermissionEnum
}

/**
 * 等级权限聚合结果。
 * 表示当前等级下的具体配额配置。
 */
export interface UserLevelPermissionsResult {
  dailyTopicLimit: number
  dailyReplyCommentLimit: number
  postInterval: number
  dailyLikeLimit: number
  dailyFavoriteLimit: number
}

/**
 * 用户等级详情返回值。
 * 包含等级展示信息、当前经验与权限聚合。
 */
export interface UserLevelInfoResult {
  levelId: number
  levelName: string
  levelDescription?: string
  levelIcon?: string
  levelColor?: string
  levelBadge?: string
  currentExperience: number
  nextLevelExperience?: number
  progressPercentage?: number
  permissions: UserLevelPermissionsResult
}

/**
 * 等级权限检查结果。
 * 包含当前等级名称、限制值、已用值与剩余额度。
 */
export interface UserLevelPermissionResult {
  hasPermission: boolean
  currentLevel: string
  limit?: number | null
  used?: number | null
  remaining?: number | null
}

/**
 * 等级分布项。
 * 表示单个等级对应的用户数量。
 */
export interface UserLevelDistributionItem {
  levelId: number
  levelName: string
  userCount: number
}

/**
 * 等级统计聚合结果。
 * 用于管理端等级概览接口。
 */
export interface UserLevelStatisticsResult {
  totalLevels: number
  enabledLevels: number
  levelDistribution: UserLevelDistributionItem[]
}
