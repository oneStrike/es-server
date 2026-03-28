import type { AppUser } from '@db/schema'
import type { QueryUserBadgePageInput } from '@libs/growth/badge'
import type { QueryUserExperienceRecordPageInput } from '@libs/growth/experience'
import type { QueryGrowthLedgerPageInput } from '@libs/growth/growth-ledger'
import type { QueryUserPointRecordPageInput } from '@libs/growth/point'

/**
 * 更新当前用户资料入参。
 * 用于用户中心资料维护，字段与 appUser 可写资料字段保持一致。
 */
export interface UpdateMyProfileInput {
  nickname?: AppUser['nickname']
  avatarUrl?: AppUser['avatarUrl']
  emailAddress?: AppUser['emailAddress']
  genderType?: AppUser['genderType']
  birthDate?: string | Date | null
  signature?: AppUser['signature']
  bio?: AppUser['bio']
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
 * 查询当前用户混合成长流水入参。
 * 复用统一账本分页筛选字段，由 service 在内部补充 userId。
 */
export interface QueryMyGrowthLedgerRecordInput
  extends Omit<QueryGrowthLedgerPageInput, 'userId'> {}

/**
 * 查询当前用户徽章列表入参。
 * 复用成长领域徽章分页筛选字段，不下沉 apps DTO 到 service。
 */
export interface QueryMyBadgeInput extends QueryUserBadgePageInput {}
