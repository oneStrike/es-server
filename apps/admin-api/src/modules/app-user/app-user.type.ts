import type { AppUser } from '@db/schema'
import type {
  AddUserExperienceInput,
  AddUserPointsInput,
  AssignUserBadgeInput,
  ConsumeUserPointsInput,
  QueryUserBadgePageInput,
  QueryUserExperienceRecordPageInput,
  QueryUserPointRecordPageInput,
} from '@libs/growth'

/**
 * APP 用户删除态筛选值。
 * 用于分页查询时表达未删除、已删除或全部用户。
 */
export type AdminAppUserDeletedScope = 'active' | 'deleted' | 'all'

/**
 * APP 用户分页查询入参。
 * 用于管理端按账号、状态、等级与最后登录时间筛选用户。
 */
export interface QueryAdminAppUserPageInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  id?: AppUser['id']
  account?: AppUser['account']
  phoneNumber?: AppUser['phoneNumber']
  nickname?: AppUser['nickname']
  emailAddress?: AppUser['emailAddress']
  isEnabled?: AppUser['isEnabled']
  status?: AppUser['status']
  levelId?: AppUser['levelId']
  deletedScope?: AdminAppUserDeletedScope
  lastLoginStartDate?: string
  lastLoginEndDate?: string
}

/**
 * APP 用户创建入参。
 * 用于管理端创建用户时传递基础资料与前端加密密码。
 */
export interface CreateAdminAppUserInput {
  nickname: AppUser['nickname']
  phoneNumber?: AppUser['phoneNumber']
  emailAddress?: AppUser['emailAddress']
  avatarUrl?: AppUser['avatarUrl']
  genderType?: AppUser['genderType']
  birthDate?: string | Date | null
  isEnabled?: AppUser['isEnabled']
  status?: AppUser['status']
  signature?: AppUser['signature']
  bio?: AppUser['bio']
  password: string
}

/**
 * APP 用户资料更新入参。
 * 仅允许更新管理端资料维护相关字段，并带目标用户 id。
 */
export interface UpdateAdminAppUserProfileInput {
  id: AppUser['id']
  nickname?: AppUser['nickname']
  avatarUrl?: AppUser['avatarUrl']
  phoneNumber?: AppUser['phoneNumber']
  emailAddress?: AppUser['emailAddress']
  genderType?: AppUser['genderType']
  birthDate?: string | Date | null
  signature?: AppUser['signature']
  bio?: AppUser['bio']
}

/**
 * APP 用户启用状态更新入参。
 * 用于切换指定用户的 isEnabled 状态。
 */
export interface UpdateAdminAppUserEnabledInput {
  id: AppUser['id']
  isEnabled: AppUser['isEnabled']
}

/**
 * APP 用户状态更新入参。
 * 用于禁言、封禁与恢复正常状态等后台操作。
 */
export interface UpdateAdminAppUserStatusInput {
  id: AppUser['id']
  status: AppUser['status']
  banReason?: AppUser['banReason']
  banUntil?: AppUser['banUntil']
}

/**
 * APP 用户密码重置入参。
 * 用于管理端传入目标用户 id 与前端 RSA 加密后的密码。
 */
export interface ResetAdminAppUserPasswordInput {
  id: AppUser['id']
  password: string
}

/**
 * APP 用户积分流水分页查询入参。
 * 复用成长领域查询字段，包含目标用户 userId。
 */
export interface QueryAdminAppUserPointRecordInput
  extends QueryUserPointRecordPageInput {}

/**
 * APP 用户手动加积分入参。
 * 复用成长领域发放积分字段，管理端补充 bizKey 与 source。
 */
export interface AddAdminAppUserPointsInput extends AddUserPointsInput {}

/**
 * APP 用户手动扣积分入参。
 * 复用成长领域扣减积分字段，管理端补充 bizKey 与 source。
 */
export interface ConsumeAdminAppUserPointsInput extends ConsumeUserPointsInput {}

/**
 * APP 用户经验流水分页查询入参。
 * 复用成长领域查询字段，包含目标用户 userId。
 */
export interface QueryAdminAppUserExperienceRecordInput
  extends QueryUserExperienceRecordPageInput {}

/**
 * APP 用户手动加经验入参。
 * 复用成长领域发放经验字段，管理端补充 bizKey 与 source。
 */
export interface AddAdminAppUserExperienceInput
  extends AddUserExperienceInput {}

/**
 * APP 用户徽章分页查询入参。
 * 复用成长领域徽章分页筛选字段，并附带目标用户 userId。
 */
export interface QueryAdminAppUserBadgeInput
  extends QueryUserBadgePageInput {
  userId: number
}

/**
 * APP 用户徽章授予或撤销入参。
 * 复用成长领域徽章指派字段，不直接下沉 DTO。
 */
export interface AssignAdminAppUserBadgeInput extends AssignUserBadgeInput {}
