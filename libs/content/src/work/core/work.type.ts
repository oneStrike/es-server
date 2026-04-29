import type { WorkSelect } from '@db/schema'
import type { BaseAuthorDto } from '@libs/content/author/dto/author.dto'
import type { BaseCategoryDto } from '@libs/content/category/dto/category.dto'
import type { BaseTagDto } from '@libs/content/tag/dto/tag.dto'
import type { PurchasePricingDto } from '@libs/interaction/purchase/dto/purchase-pricing.dto'

/**
 * 作品详情请求上下文。
 * 仅供 service 内部在 app 与 admin 入口之间透传访问者信息。
 */
export interface WorkDetailContext {
  userId?: number
  ipAddress?: string
  device?: string
  userAgent?: string
  bypassVisibilityCheck?: boolean
}

/**
 * 作品公开详情使用的作品字段快照。
 * 从 Drizzle 作品行裁剪出公开接口需要的字段，避免使用宽泛类型。
 */
export type WorkPublicDetailRow = Pick<
  WorkSelect,
  | 'id'
  | 'name'
  | 'type'
  | 'cover'
  | 'popularity'
  | 'isRecommended'
  | 'isHot'
  | 'isNew'
  | 'serialStatus'
  | 'publisher'
  | 'language'
  | 'region'
  | 'ageRating'
  | 'createdAt'
  | 'updatedAt'
  | 'publishAt'
  | 'isPublished'
  | 'alias'
  | 'description'
  | 'originalSource'
  | 'copyright'
  | 'disclaimer'
  | 'lastUpdated'
  | 'viewRule'
  | 'requiredViewLevelId'
  | 'forumSectionId'
  | 'canComment'
  | 'viewCount'
  | 'favoriteCount'
  | 'likeCount'
  | 'commentCount'
  | 'downloadCount'
  | 'rating'
>

/**
 * 作品详情作者快照。
 * 复用作者 DTO 字段定义，并额外携带当前用户关注状态。
 */
export type WorkPublicDetailAuthor = Pick<
  BaseAuthorDto,
  'id' | 'name' | 'type' | 'avatar'
> & {
  isFollowed?: boolean
}

/**
 * 作品详情分类快照。
 * 与分页和详情接口公开的分类字段保持一致。
 */
export type WorkPublicDetailCategory = Pick<
  BaseCategoryDto,
  'id' | 'name' | 'icon'
>

/**
 * 作品详情标签快照。
 * 与分页和详情接口公开的标签字段保持一致。
 */
export type WorkPublicDetailTag = Pick<BaseTagDto, 'id' | 'name' | 'icon'>

/**
 * 构建公开作品详情的入参。
 * 统一替代 service 方法签名中的内联对象类型。
 */
export interface BuildPublicWorkDetailParams {
  work: WorkPublicDetailRow
  authors: WorkPublicDetailAuthor[]
  categories: WorkPublicDetailCategory[]
  tags: WorkPublicDetailTag[]
  chapterPurchasePricing: PurchasePricingDto | null
}

/**
 * 作品分页条件选项。
 * 区分 app 强制已发布与管理端传参过滤两种路径。
 */
export interface WorkPageConditionOptions {
  forcePublished?: boolean
}

/**
 * 作品分页查询选项。
 * 控制是否只查询列表页需要的最小字段集。
 */
export interface WorkPaginationOptions extends WorkPageConditionOptions {
  selectPageFields?: boolean
}

/**
 * 作品展示标志位更新入参。
 * 供管理端快速切换发布、推荐、热门、新作状态。
 */
export type WorkFlagUpdateInput = Partial<
  Pick<WorkSelect, 'isPublished' | 'isRecommended' | 'isHot' | 'isNew'>
>

/**
 * 阅读状态批量解析的章节引用。
 * 由阅读状态服务传入，要求同时携带作品 ID 和章节 ID 以避免跨作品误匹配。
 */
export interface WorkReadingChapterRef {
  workId: number
  chapterId: number
}
