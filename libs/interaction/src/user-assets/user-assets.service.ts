import type {
  UserAssetsCountRow,
  UserAssetsDistinctWorkCountRow,
  UserAssetsSummary,
} from './user-assets.type'
import { DrizzleService } from '@db/core'
import {
  CONTENT_PURCHASE_ENTITLEMENT_TARGET_TYPES,
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementStatusEnum,
  MembershipSubscriptionStatusEnum,
} from '@libs/content/permission/content-entitlement.constant'

import { GrowthAssetTypeEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import { DOWNLOAD_WORK_CHAPTER_TARGET_TYPES } from '../download/download.constant'
import {
  CouponInstanceStatusEnum,
  READING_COIN_ASSET_KEY,
} from '../monetization/monetization.constant'

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

  private get userContentEntitlement() {
    return this.drizzle.schema.userContentEntitlement
  }

  private get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  private get userMembershipSubscription() {
    return this.drizzle.schema.userMembershipSubscription
  }

  private get userCouponInstance() {
    return this.drizzle.schema.userCouponInstance
  }

  private get userDownloadRecord() {
    return this.drizzle.schema.userDownloadRecord
  }

  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  async getUserAssetsSummary(userId: number): Promise<UserAssetsSummary> {
    const [
      commentCount,
      likeCount,
      favoriteCount,
      viewCount,
      purchasedChapterCount,
      downloadedChapterCount,
      purchasedWorkRows,
      downloadedWorkRows,
      currencyBalanceRow,
      vipRows,
      availableCouponCount,
    ] = await Promise.all([
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.userComment)
        .where(
          and(
            eq(this.userComment.userId, userId),
            isNull(this.userComment.deletedAt),
          ),
        ),
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.userLike)
        .where(eq(this.userLike.userId, userId)),
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.userFavorite)
        .where(eq(this.userFavorite.userId, userId)),
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.userBrowseLog)
        .where(eq(this.userBrowseLog.userId, userId)),
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.userContentEntitlement)
        .where(
          and(
            eq(this.userContentEntitlement.userId, userId),
            eq(
              this.userContentEntitlement.grantSource,
              ContentEntitlementGrantSourceEnum.PURCHASE,
            ),
            eq(
              this.userContentEntitlement.status,
              ContentEntitlementStatusEnum.ACTIVE,
            ),
            inArray(this.userContentEntitlement.targetType, [
              ...CONTENT_PURCHASE_ENTITLEMENT_TARGET_TYPES,
            ]),
          ),
        ),
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.userDownloadRecord)
        .where(
          and(
            eq(this.userDownloadRecord.userId, userId),
            inArray(this.userDownloadRecord.targetType, [
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
        .from(this.userContentEntitlement)
        .innerJoin(
          this.workChapter,
          eq(this.workChapter.id, this.userContentEntitlement.targetId),
        )
        .where(
          and(
            eq(this.userContentEntitlement.userId, userId),
            eq(
              this.userContentEntitlement.grantSource,
              ContentEntitlementGrantSourceEnum.PURCHASE,
            ),
            eq(
              this.userContentEntitlement.status,
              ContentEntitlementStatusEnum.ACTIVE,
            ),
            inArray(this.userContentEntitlement.targetType, [
              ...CONTENT_PURCHASE_ENTITLEMENT_TARGET_TYPES,
            ]),
          ),
        ),
      this.db
        .select({
          total: sql<
            UserAssetsDistinctWorkCountRow['total']
          >`COUNT(DISTINCT ${this.workChapter.workId})::bigint`,
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
              ...DOWNLOAD_WORK_CHAPTER_TARGET_TYPES,
            ]),
          ),
        ),
      this.db.query.userAssetBalance.findFirst({
        where: {
          userId,
          assetType: GrowthAssetTypeEnum.CURRENCY,
          assetKey: READING_COIN_ASSET_KEY,
        },
        columns: {
          balance: true,
        },
      }),
      this.db
        .select({
          vipExpiresAt: sql<Date | null>`max(${this.userMembershipSubscription.endsAt})`,
        })
        .from(this.userMembershipSubscription)
        .where(
          and(
            eq(this.userMembershipSubscription.userId, userId),
            eq(
              this.userMembershipSubscription.status,
              MembershipSubscriptionStatusEnum.ACTIVE,
            ),
            gt(this.userMembershipSubscription.endsAt, new Date()),
          ),
        ),
      this.db
        .select({ count: sql<UserAssetsCountRow['count']>`count(*)::int` })
        .from(this.userCouponInstance)
        .where(
          and(
            eq(this.userCouponInstance.userId, userId),
            eq(
              this.userCouponInstance.status,
              CouponInstanceStatusEnum.AVAILABLE,
            ),
            gt(this.userCouponInstance.remainingUses, 0),
          ),
        ),
    ])

    return {
      currencyBalance: currencyBalanceRow?.balance ?? 0,
      vipExpiresAt: vipRows[0]?.vipExpiresAt ?? null,
      availableCouponCount: Number(availableCouponCount[0]?.count ?? 0),
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
