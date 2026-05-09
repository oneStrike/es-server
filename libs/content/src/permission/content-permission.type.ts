import type { work, workChapter } from '@db/schema'

import type { WorkViewPermissionEnum } from '@libs/platform/constant'

/**
 * 章节购买价格快照。
 * 仅保留权限链路真正依赖的价格字段，避免内部领域类型直接依赖 HTTP DTO。
 */
export interface PurchasePricingSnapshot {
  originalPrice: number
  payableRate: number
  payablePrice: number
  discountAmount: number
}

/**
 * 章节权限判定所需的最小章节快照。
 * 字段范围控制在权限、价格和功能开关相关字段，避免把整章实体在权限链路里到处透传。
 */
export type PermissionChapterData = Pick<
  typeof workChapter.$inferSelect,
  | 'workId'
  | 'workType'
  | 'viewRule'
  | 'price'
  | 'canDownload'
  | 'canComment'
  | 'isPreview'
>

/**
 * 作品权限判定所需的最小作品快照。
 * 主要用于章节继承作品权限时，统一读取父级规则。
 */
export type WorkPermissionData = Pick<
  typeof work.$inferSelect,
  'viewRule' | 'chapterPrice' | 'canComment'
>

/**
 * 统一的访问规则上下文。
 * 作品阅读、章节阅读和章节下载都会先整理成这个结构，再进入同一套权限判断流程。
 */
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
export interface ResolvedChapterPermission {
  workType: PermissionChapterData['workType']
  canDownload: PermissionChapterData['canDownload']
  viewRule: WorkViewPermissionEnum
  requiredViewLevelId: number | null
  requiredExperience: number | null
  isPreview: PermissionChapterData['isPreview']
  purchasePricing: PurchasePricingSnapshot | null
}

/**
 * 章节权限校验结果。
 * 权限通过后返回原始章节数据与调用方额外选择的字段。
 */
export interface ChapterAccessResult<T = object> {
  hasPermission: true
  chapter: T
}
