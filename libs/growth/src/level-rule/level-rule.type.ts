import type { IntegrityLockRequest } from '@db/core'
import type { UserLevelRuleSelect } from '@db/schema'

/** 等级规则业务域标识，null/undefined 表示默认全局等级域。 */
export type LevelBusiness = string | null | undefined

/** 等级规则内部使用的规范化业务域。 */
export type NormalizedLevelBusiness = string | null

/** 配额与频控计划的闭集种类。 */
export type LevelRuleRateLimitKind =
  | 'daily-like-quota'
  | 'daily-favorite-quota'
  | 'comment-rate-limit'
  | 'forum-topic-rate-limit'

/**
 * 事务外构建的等级配额/频控锁计划。
 * 同一计划的业务域和日界线同时驱动锁 owner 与锁内查询，避免跨午夜漂移。
 */
export interface LevelRuleRateLimitLockPlan<
  TKind extends LevelRuleRateLimitKind = LevelRuleRateLimitKind,
> {
  readonly kind: TKind
  readonly userId: number
  readonly business: NormalizedLevelBusiness
  readonly dayStartMs: number
  readonly lockRequests: readonly IntegrityLockRequest[]
}

/** 每日点赞额度锁计划。 */
export type DailyLikeQuotaLockPlan =
  LevelRuleRateLimitLockPlan<'daily-like-quota'>

/** 每日收藏额度锁计划。 */
export type DailyFavoriteQuotaLockPlan =
  LevelRuleRateLimitLockPlan<'daily-favorite-quota'>

/** 评论额度与发帖间隔锁计划。 */
export type CommentRateLimitLockPlan =
  LevelRuleRateLimitLockPlan<'comment-rate-limit'>

/** 论坛主题额度与发帖间隔锁计划。 */
export type ForumTopicRateLimitLockPlan =
  LevelRuleRateLimitLockPlan<'forum-topic-rate-limit'>

/** 解析用户有效等级的输入。 */
export interface LevelResolveInput {
  userId: number
  business?: LevelBusiness
}

/** 按经验值反查等级规则的输入。 */
export interface LevelRuleResolveInput {
  experience: number
  business?: LevelBusiness
}

/** 等级每日额度校验输入。 */
export interface DailyQuotaInput {
  userId: number
  business?: LevelBusiness
}

/** 等级购买折扣价格计算输入。 */
export interface PurchasePricingInput {
  userId: number
  originalPrice: number
  business?: LevelBusiness
}

/** 等级购买折扣价格计算结果。 */
export interface LevelPurchasePricing {
  originalPrice: number
  levelPayableRate: string
  levelPayablePrice: number
  levelDiscountAmount: number
}

/** 等级规则对外读取投影。 */
export type LevelRuleOutputRow = Pick<
  UserLevelRuleSelect,
  | 'id'
  | 'name'
  | 'requiredExperience'
  | 'description'
  | 'icon'
  | 'color'
  | 'sortOrder'
  | 'isEnabled'
  | 'business'
  | 'dailyTopicLimit'
  | 'dailyReplyCommentLimit'
  | 'postInterval'
  | 'dailyLikeLimit'
  | 'dailyFavoriteLimit'
  | 'purchasePayableRate'
  | 'createdAt'
  | 'updatedAt'
>
