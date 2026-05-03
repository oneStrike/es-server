import type { AppUserSelect } from '@db/schema'
import type { UserMentionCandidateDto } from './dto/user-self.dto'

/**
 * 用户成长余额快照。
 * 仅承载跨表读取出来的积分与经验热余额，不承担 HTTP 文档职责。
 */
export interface UserGrowthSnapshot {
  points: number
  experience: number
}

/**
 * 提及候选分页结果。
 * 供共享用户服务与 app 端 controller 链路复用统一分页结构。
 */
export interface UserMentionCandidatePageResult {
  list: UserMentionCandidateDto[]
  total: number
  pageIndex: number
  pageSize: number
  totalPages: number
}

/**
 * 封禁提示文案依赖的最小字段集。
 * 只保留原因与截止时间，避免服务方法签名内联匿名对象类型。
 */
export type UserBanAccessSource = Pick<AppUserSelect, 'banReason' | 'banUntil'>

/**
 * 封禁校验依赖的最小字段集。
 * 供登录、鉴权守卫等链路复用统一的封禁态判定输入。
 */
export type UserBanGuardSource = Pick<
  AppUserSelect,
  'status' | 'banReason' | 'banUntil'
>

/**
 * 用户状态摘要依赖的最小字段集。
 * 收敛能力开关判定需要的启用态、状态码与限制信息。
 */
export type UserStatusSource = Pick<
  AppUserSelect,
  'isEnabled' | 'status' | 'banReason' | 'banUntil'
>

/**
 * APP 用户访问检查依赖的最小字段集。
 * HTTP guard 与 WebSocket 入口只消费判定结果，不直接读取 app_user。
 */
export type AppUserAccessCheckUser = Pick<
  AppUserSelect,
  'id' | 'isEnabled' | 'status' | 'banReason' | 'banUntil'
>

/**
 * APP 用户访问检查结果。
 * 共享事实源只表达状态，不抛入口协议异常。
 */
export interface AppUserAccessAllowedResult {
  allowed: true
  user: AppUserAccessCheckUser
}

/**
 * APP 用户不存在或已删除时的访问检查结果。
 */
export interface AppUserAccessNotFoundResult {
  allowed: false
  reason: 'not_found'
}

/**
 * APP 用户被禁用时的访问检查结果。
 */
export interface AppUserAccessDisabledResult {
  allowed: false
  reason: 'disabled'
  message: string
}

/**
 * APP 用户被封禁时的访问检查结果。
 */
export interface AppUserAccessBannedResult {
  allowed: false
  reason: 'banned'
  code: number
  message: string
}

/**
 * APP 用户访问拒绝原因到结果结构的映射。
 */
export interface AppUserAccessDeniedResultMap {
  not_found: AppUserAccessNotFoundResult
  disabled: AppUserAccessDisabledResult
  banned: AppUserAccessBannedResult
}

/**
 * APP 用户访问检查拒绝结果。
 */
export type AppUserAccessDeniedResult =
  AppUserAccessDeniedResultMap[keyof AppUserAccessDeniedResultMap]

/**
 * APP 用户访问检查的完整判定结果。
 */
export type AppUserAccessCheckResult =
  | AppUserAccessAllowedResult
  | AppUserAccessDeniedResult
