import type { AppUserSelect } from '@db/schema'
import type { QueryUserBadgeDto } from '@libs/growth/badge'
import type { QueryUserExperienceRecordPageInput } from '@libs/growth/experience'
import type { QueryUserPointRecordPageInput } from '@libs/growth/point'

/**
 * 更新当前用户资料入参。
 * 用于用户中心资料维护，字段与 appUser 可写资料字段保持一致。
 */
export interface UpdateMyProfileInput {
  nickname?: AppUserSelect['nickname']
  avatarUrl?: AppUserSelect['avatarUrl']
  emailAddress?: AppUserSelect['emailAddress']
  genderType?: AppUserSelect['genderType']
  birthDate?: string | Date | null
  signature?: AppUserSelect['signature']
  bio?: AppUserSelect['bio']
}

/**
 * 换绑当前用户手机号入参。
 * 要求同时提供旧手机号、新手机号及各自验证码，用于高风险手机号变更操作。
 */
export interface ChangeMyPhoneInput {
  currentPhone: NonNullable<AppUserSelect['phoneNumber']>
  currentCode: string
  newPhone: NonNullable<AppUserSelect['phoneNumber']>
  newCode: string
}

/**
 * 查询当前用户积分流水入参。
 * 复用成长领域分页筛选字段，由 service 在内部补充 userId。
 */
export interface QueryMyPointRecordInput
  extends Omit<QueryUserPointRecordPageInput, 'userId'> {}

/**
 * 查询当前用户经验流水入参。
 * 复用成长领域分页筛选字段，由 service 在内部补充 userId。
 */
export interface QueryMyExperienceRecordInput
  extends Omit<QueryUserExperienceRecordPageInput, 'userId'> {}

/**
 * 查询当前用户徽章列表入参。
 * 复用成长领域徽章分页筛选字段，不下沉 apps DTO 到 service。
 */
export interface QueryMyBadgeInput extends QueryUserBadgeDto {}
