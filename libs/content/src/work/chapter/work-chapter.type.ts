import type { WorkChapterSelect } from '@db/schema'
import type {
  WorkTypeEnum,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
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
  expectedType?: WorkTypeEnum
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

/**
 * app/admin 章节详情共同的持久化读取字段。
 * 正文按作品类型拆列；查询层只读取此稳定 contract，避免新 schema 列被详情端点隐式带入。
 */
export type WorkChapterDetailReadRow = Pick<
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
  | 'price'
  | 'canDownload'
  | 'canComment'
  | 'novelContentPath'
  | 'comicContentManifest'
  | 'wordCount'
  | 'viewCount'
  | 'likeCount'
  | 'commentCount'
  | 'purchaseCount'
  | 'downloadCount'
  | 'remark'
  | 'createdAt'
  | 'updatedAt'
>

/** 后台章节详情在共同读取字段外追加已加载的关系摘要。 */
export type WorkChapterAdminDetailRow = WorkChapterDetailReadRow & {
  content: string | string[] | null
  work: {
    id: number
    name: string
    type: number
  } | null
  requiredViewLevel: {
    id: number
    name: string
    color: string | null
  } | null
}

/** app 章节分页查询使用的章节字段投影，避免公开列表依赖完整章节行。 */
export type AppChapterPageRow = Pick<
  WorkChapterSelect,
  | 'id'
  | 'workId'
  | 'workType'
  | 'title'
  | 'subtitle'
  | 'cover'
  | 'sortOrder'
  | 'isPublished'
  | 'isPreview'
  | 'publishAt'
  | 'viewRule'
  | 'price'
  | 'canDownload'
  | 'canComment'
  | 'createdAt'
  | 'updatedAt'
>

/** admin 章节分页查询使用的章节字段投影，包含后台列表额外展示字段。 */
export type AdminChapterPageRow = Pick<
  WorkChapterSelect,
  | 'id'
  | 'workId'
  | 'workType'
  | 'cover'
  | 'title'
  | 'subtitle'
  | 'sortOrder'
  | 'viewRule'
  | 'price'
  | 'requiredViewLevelId'
  | 'isPreview'
  | 'canDownload'
  | 'canComment'
  | 'isPublished'
  | 'publishAt'
  | 'createdAt'
  | 'updatedAt'
>
