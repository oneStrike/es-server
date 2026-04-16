import type { appUser, work, workChapter } from '@db/schema'

import type { WorkViewPermissionEnum } from '@libs/platform/constant/content.constant'

/**
 * 章节购买价格快照。
 * 仅保留权限链路真正依赖的价格字段，避免内部领域类型直接依赖 HTTP DTO。
 */
/** 稳定领域类型 `PurchasePricingSnapshot`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface PurchasePricingSnapshot {
  originalPrice: number
  payableRate: number
  payablePrice: number
  discountAmount: number
}

/**
 * 携带等级快照的用户结构。
 * 供会员权限校验复用，避免 service 内部散落临时对象类型。
 */
/** 稳定领域类型 `UserWithLevel`。仅供内部领域/服务链路复用，避免重复定义。 */
export type UserWithLevel = typeof appUser.$inferSelect & {
  level: { requiredExperience: number } | null
}

/**
 * 章节权限判定所需的最小章节快照。
 * 字段范围控制在权限、价格和功能开关相关字段，避免把整章实体在权限链路里到处透传。
 */
/** 稳定领域类型 `PermissionChapterData`。仅供内部领域/服务链路复用，避免重复定义。 */
export type PermissionChapterData = Pick<
  typeof workChapter.$inferSelect,
  | 'workId'
  | 'workType'
  | 'viewRule'
  | 'requiredViewLevelId'
  | 'price'
  | 'canDownload'
  | 'canComment'
  | 'isPreview'
> & {
  requiredViewLevel: { requiredExperience: number } | null
}

/**
 * 作品权限判定所需的最小作品快照。
 * 主要用于章节继承作品权限时，统一读取父级规则。
 */
/** 稳定领域类型 `WorkPermissionData`。仅供内部领域/服务链路复用，避免重复定义。 */
export type WorkPermissionData = Pick<
  typeof work.$inferSelect,
  'viewRule' | 'requiredViewLevelId' | 'chapterPrice' | 'canComment'
> & {
  requiredViewLevel: { requiredExperience: number } | null
}

/**
 * 统一的访问规则上下文。
 * 作品阅读、章节阅读和章节下载都会先整理成这个结构，再进入同一套权限判断流程。
 */
/** 稳定领域类型 `AccessRuleContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface AccessRuleContext {
  scope: 'work' | 'chapter'
  requiredExperience: number | null
  viewRule: WorkViewPermissionEnum
  isPreview?: boolean
  chapterId?: number
}

/**
 * 章节展开后的生效权限结构。
 * 统一承载 app 侧章节展示和购买链路所需的最终权限、等级与价格信息。
 */
/** 稳定领域类型 `ResolvedChapterPermission`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ResolvedChapterPermission {
  workType: PermissionChapterData['workType']
  canDownload: PermissionChapterData['canDownload']
  viewRule: WorkViewPermissionEnum
  requiredViewLevelId: number | null
  requiredExperience: number | null
  isPreview: PermissionChapterData['isPreview']
  purchasePricing: PurchasePricingSnapshot | null
}
