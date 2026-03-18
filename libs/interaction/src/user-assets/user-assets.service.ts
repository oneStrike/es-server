import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { DownloadTargetTypeEnum } from '../download/download.constant'
import { PurchaseStatusEnum, PurchaseTargetTypeEnum } from '../purchase/purchase.constant'

@Injectable()
export class UserAssetsService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get userComment() {
    return this.drizzle.schema.userComment
  }

  private get userLike() {
    return this.drizzle.schema.userLike
  }

  private get userFavorite() {
    return this.drizzle.schema.userFavorite
  }

  private get userBrowseLog() {
    return this.drizzle.schema.userBrowseLog
  }

  private get userPurchaseRecord() {
    return this.drizzle.schema.userPurchaseRecord
  }

  private get userDownloadRecord() {
    return this.drizzle.schema.userDownloadRecord
  }

  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  async getUserAssetsSummary(userId: number) {
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
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userComment)
        .where(
          and(eq(this.userComment.userId, userId), isNull(this.userComment.deletedAt)),
        ),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userLike)
        .where(eq(this.userLike.userId, userId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userFavorite)
        .where(eq(this.userFavorite.userId, userId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userBrowseLog)
        .where(eq(this.userBrowseLog.userId, userId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userPurchaseRecord)
        .where(
          and(
            eq(this.userPurchaseRecord.userId, userId),
            eq(this.userPurchaseRecord.status, PurchaseStatusEnum.SUCCESS),
            inArray(this.userPurchaseRecord.targetType, [
              PurchaseTargetTypeEnum.COMIC_CHAPTER,
              PurchaseTargetTypeEnum.NOVEL_CHAPTER,
            ]),
          ),
        ),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userDownloadRecord)
        .where(
          and(
            eq(this.userDownloadRecord.userId, userId),
            inArray(this.userDownloadRecord.targetType, [
              DownloadTargetTypeEnum.COMIC_CHAPTER,
              DownloadTargetTypeEnum.NOVEL_CHAPTER,
            ]),
          ),
        ),
      this.db
        .select({
          total: sql<bigint>`COUNT(DISTINCT ${this.workChapter.workId})::bigint`,
        })
        .from(this.userPurchaseRecord)
        .innerJoin(
          this.workChapter,
          eq(this.workChapter.id, this.userPurchaseRecord.targetId),
        )
        .where(
          and(
            eq(this.userPurchaseRecord.userId, userId),
            eq(this.userPurchaseRecord.status, PurchaseStatusEnum.SUCCESS),
            inArray(this.userPurchaseRecord.targetType, [
              PurchaseTargetTypeEnum.COMIC_CHAPTER,
              PurchaseTargetTypeEnum.NOVEL_CHAPTER,
            ]),
          ),
        ),
      this.db
        .select({
          total: sql<bigint>`COUNT(DISTINCT ${this.workChapter.workId})::bigint`,
        })
        .from(this.userDownloadRecord)
        .innerJoin(
          this.workChapter,
          eq(this.workChapter.id, this.userDownloadRecord.targetId),
        )
        .where(
          and(
            eq(this.userDownloadRecord.userId, userId),
            inArray(this.userDownloadRecord.targetType, [
              DownloadTargetTypeEnum.COMIC_CHAPTER,
              DownloadTargetTypeEnum.NOVEL_CHAPTER,
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
