import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import { GrowthAssetTypeEnum } from './growth-ledger.constant'

export interface UserGrowthSnapshot {
  points: number
  experience: number
}

/**
 * 成长余额查询服务。
 *
 * 只负责从 `user_asset_balance` 读取积分/经验热余额快照，供 admin/app/forum
 * 等读模型复用，避免把余额语义下沉到用户域。
 */
@Injectable()
export class GrowthBalanceQueryService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  /**
   * 读取单用户成长余额快照。
   */
  async getUserGrowthSnapshot(userId: number): Promise<UserGrowthSnapshot> {
    const snapshotMap = await this.getUserGrowthSnapshotMap([userId])
    return (
      snapshotMap.get(userId) ?? {
        points: 0,
        experience: 0,
      }
    )
  }

  /**
   * 批量读取用户成长余额快照。
   */
  async getUserGrowthSnapshotMap(
    userIds: number[],
  ): Promise<Map<number, UserGrowthSnapshot>> {
    const uniqueUserIds = [...new Set(userIds)]
    if (uniqueUserIds.length === 0) {
      return new Map<number, UserGrowthSnapshot>()
    }

    const rows = await this.db
      .select({
        userId: this.userAssetBalance.userId,
        assetType: this.userAssetBalance.assetType,
        balance: this.userAssetBalance.balance,
      })
      .from(this.userAssetBalance)
      .where(
        and(
          inArray(this.userAssetBalance.userId, uniqueUserIds),
          inArray(this.userAssetBalance.assetType, [
            GrowthAssetTypeEnum.POINTS,
            GrowthAssetTypeEnum.EXPERIENCE,
          ]),
          eq(this.userAssetBalance.assetKey, ''),
        ),
      )

    const snapshotMap = new Map<number, UserGrowthSnapshot>()
    for (const userId of uniqueUserIds) {
      snapshotMap.set(userId, {
        points: 0,
        experience: 0,
      })
    }

    for (const row of rows) {
      const current = snapshotMap.get(row.userId) ?? {
        points: 0,
        experience: 0,
      }
      if (row.assetType === GrowthAssetTypeEnum.POINTS) {
        current.points = row.balance
      } else if (row.assetType === GrowthAssetTypeEnum.EXPERIENCE) {
        current.experience = row.balance
      }
      snapshotMap.set(row.userId, current)
    }

    return snapshotMap
  }
}
