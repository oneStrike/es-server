import type { WorkChapterSelect } from '@db/schema'
import type { WorkViewPermissionEnum } from '@libs/platform/constant'
import type { ContentPurchasePricingDto } from '../../permission/dto/content-purchase-pricing.dto'

/**
 * 章节拖拽排序入参。
 * 通过 dragId 与 targetId 在同作品下交换章节顺序。
 */
export interface SwapWorkChapterNumbersInput {
  dragId: number
  targetId: number
}

/**
 * 章节详情请求上下文。
 * 供 app 与 admin 入口复用章节详情查询时透传访问者信息。
 */
export interface WorkChapterDetailContext {
  userId?: number
  ipAddress?: string
  device?: string
  bypassVisibilityCheck?: boolean
}

/**
 * 章节分页请求上下文。
 * 控制是否按 app 可见性规则展开权限信息。
 */
export interface WorkChapterPageContext {
  userId?: number
  bypassVisibilityCheck?: boolean
}

/**
 * 公开章节详情使用的章节字段快照。
 * 额外携带解析后的权限与购买价格，避免 service 方法使用宽泛类型。
 */
export type WorkChapterPublicDetailRow = Pick<
  WorkChapterSelect,
  | 'id'
  | 'workId'
  | 'workType'
  | 'title'
  | 'subtitle'
  | 'cover'
  | 'description'
  | 'sortOrder'
  | 'isPublished'
  | 'isPreview'
  | 'publishAt'
  | 'viewRule'
  | 'requiredViewLevelId'
  | 'canDownload'
  | 'canComment'
  | 'wordCount'
  | 'viewCount'
  | 'likeCount'
  | 'commentCount'
  | 'purchaseCount'
  | 'downloadCount'
  | 'createdAt'
  | 'updatedAt'
> & {
  content: string | string[] | null
  resolvedViewRule?: WorkViewPermissionEnum
  resolvedRequiredViewLevelId?: number | null
  purchasePricing?: ContentPurchasePricingDto | null
}
