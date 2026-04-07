import type {
  UserAssetsCountRow,
  UserAssetsDistinctWorkCountRow,
  UserAssetsSummary,
} from './user-assets.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { DOWNLOAD_WORK_CHAPTER_TARGET_TYPES } from '../download/download.constant'
import {
  PURCHASE_WORK_CHAPTER_TARGET_TYPES,
  PurchaseStatusEnum,
} from '../purchase/purchase.constant'

@Injectable()
export class UserAssetsService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get appUserComment() {
    return this.drizzle.schema.appUserComment
  }

  private get appUserLike() {
    return this.drizzle.schema.appUserLike
  }

  private get appUserFavorite() {
    return this.drizzle.schema.appUserFavorite
  }

  private get appUserBrowseLog() {
    return this.drizzle.schema.appUserBrowseLog
  }

  private get appUserPurchaseRecord() {
    return this.drizzle.schema.appUserPurchaseRecord
  }

  private get appUserDownloadRecord() {
    return this.drizzle.schema.appUserDownloadRecord
  }

  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  async getUserAssetsSummary(
    userId: number,
  ): Promise<UserAssetsSummary> {
    const [
      commentCount,
      likeCount,
      favoriteCount,
      viewCount,
      purchasedChapterCount,
      downloadedChapterCount,
      purchasedWorkRows,
      downloadedWorkRows,
    ] = await Promise.all([
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.appUserComment)
        .where(
          and(
            eq(this.appUserComment.userId, userId),
            isNull(this.appUserComment.deletedAt),
          ),
        ),
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.appUserLike)
        .where(eq(this.appUserLike.userId, userId)),
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.appUserFavorite)
        .where(eq(this.appUserFavorite.userId, userId)),
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.appUserBrowseLog)
        .where(eq(this.appUserBrowseLog.userId, userId)),
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.appUserPurchaseRecord)
        .where(
          and(
            eq(this.appUserPurchaseRecord.userId, userId),
            eq(this.appUserPurchaseRecord.status, PurchaseStatusEnum.SUCCESS),
            inArray(this.appUserPurchaseRecord.targetType, [
              ...PURCHASE_WORK_CHAPTER_TARGET_TYPES,
            ]),
          ),
        ),
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.appUserDownloadRecord)
        .where(
          and(
            eq(this.appUserDownloadRecord.userId, userId),
            inArray(this.appUserDownloadRecord.targetType, [
              ...DOWNLOAD_WORK_CHAPTER_TARGET_TYPES,
            ]),
          ),
        ),
      this.db
        .select({
          total: sql<
            UserAssetsDistinctWorkCountRow['total']
          >`COUNT(DISTINCT ${this.workChapter.workId})::bigint`,
        })
        .from(this.appUserPurchaseRecord)
        .innerJoin(
          this.workChapter,
          eq(this.workChapter.id, this.appUserPurchaseRecord.targetId),
        )
        .where(
          and(
            eq(this.appUserPurchaseRecord.userId, userId),
            eq(this.appUserPurchaseRecord.status, PurchaseStatusEnum.SUCCESS),
            inArray(this.appUserPurchaseRecord.targetType, [
              ...PURCHASE_WORK_CHAPTER_TARGET_TYPES,
            ]),
          ),
        ),
      this.db
        .select({
          total: sql<
            UserAssetsDistinctWorkCountRow['total']
          >`COUNT(DISTINCT ${this.workChapter.workId})::bigint`,
        })
        .from(this.appUserDownloadRecord)
        .innerJoin(
          this.workChapter,
          eq(this.workChapter.id, this.appUserDownloadRecord.targetId),
        )
        .where(
          and(
            eq(this.appUserDownloadRecord.userId, userId),
            inArray(this.appUserDownloadRecord.targetType, [
              ...DOWNLOAD_WORK_CHAPTER_TARGET_TYPES,
            ]),
          ),
        ),
    ])

    return {
      purchasedWorkCount: Number(purchasedWorkRows[0]?.total ?? 0n),
      purchasedChapterCount: Number(purchasedChapterCount[0]?.count ?? 0),
      downloadedWorkCount: Number(downloadedWorkRows[0]?.total ?? 0n),
      downloadedChapterCount: Number(downloadedChapterCount[0]?.count ?? 0),
      favoriteCount: Number(favoriteCount[0]?.count ?? 0),
      likeCount: Number(likeCount[0]?.count ?? 0),
      viewCount: Number(viewCount[0]?.count ?? 0),
      commentCount: Number(commentCount[0]?.count ?? 0),
    }
  }
}
