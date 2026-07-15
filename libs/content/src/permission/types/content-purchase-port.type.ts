/** 数据库存储的购买价格快照源字段。 */
export interface PurchasePricingSnapshotSource {
  originalPrice: number
  paidPrice: number
  payableRate: number | string
}

/** 已购作品历史 SQL 投影。 */
export interface PurchasedWorkHistoryRow {
  workId: number
  workType: number
  workName: string
  workCover: string
  purchasedChapterCount: bigint
  lastPurchasedAt: Date
}

/** 已购章节历史 SQL 投影。 */
export interface PurchasedWorkChapterHistoryRow {
  id: number
  targetType: number
  targetId: number
  userId: number
  originalPrice: number
  paidPrice: number
  payableRate: string | number
  status: number
  paymentMethod: number
  outTradeNo: string | null
  discountAmount: number
  couponInstanceId: number | null
  discountSource: number
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
