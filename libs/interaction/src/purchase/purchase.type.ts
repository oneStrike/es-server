import type { UserPurchaseRecord } from '@db/schema'
import type { PurchaseTargetTypeEnum } from './purchase.constant'

/**
 * 购买目标入参。
 * - 用于创建购买记录与扣减积分
 */
export type PurchaseTargetInput = Pick<
  UserPurchaseRecord,
  'targetType' | 'targetId' | 'userId' | 'paymentMethod'
> & {
  outTradeNo?: string | null
}

/**
 * 已购作品列表查询入参。
 * - 支持状态、目标类型、作品类型与时间区间筛选
 * - 分页参数与 PageDto 语义保持一致
 */
export type PurchasedWorksQuery = Pick<UserPurchaseRecord, 'userId'> &
  Partial<Pick<UserPurchaseRecord, 'status' | 'targetType'>> & {
    workType?: number
    pageIndex?: number
    pageSize?: number
    startDate?: string
    endDate?: string
  }

/**
 * 已购章节列表查询入参。
 * - 在作品列表查询入参基础上增加作品ID
 */
export type PurchasedWorkChaptersQuery = PurchasedWorksQuery & {
  workId: number
}

/**
 * 已购作品聚合查询行。
 * - 对应已购作品列表 SQL 查询结果结构
 */
export interface PurchasedWorkRow {
  workId: number
  workType: number
  workName: string
  workCover: string
  purchasedChapterCount: bigint
  lastPurchasedAt: Date
}

/**
 * 已购作品总数查询行。
 * - 对应 COUNT(DISTINCT work_id) 聚合结果
 */
export interface PurchasedWorkTotalRow {
  total: bigint
}

/**
 * 已购章节列表查询行。
 * - 对应已购章节列表 SQL 查询结果结构
 */
export interface PurchasedWorkChapterRow {
  id: number
  targetType: number
  targetId: number
  userId: number
  price: number
  status: number
  paymentMethod: number
  outTradeNo: string | null
  createdAt: Date
  updatedAt: Date
  chapterId: number
  chapterWorkId: number
  chapterWorkType: number
  chapterTitle: string
  chapterSubtitle: string | null
  chapterCover: string | null
  chapterSortOrder: number
  chapterIsPublished: boolean
  chapterPublishAt: Date | null
}

/**
 * 已购章节总数查询行。
 * - 对应 COUNT(*) 聚合结果
 */
export interface PurchasedWorkChapterTotalRow {
  total: bigint
}

/**
 * 购买目标类型路由键。
 * - 用于与解析器映射保持一致的类型约束
 */
export type PurchaseTargetRouteKey = PurchaseTargetTypeEnum
