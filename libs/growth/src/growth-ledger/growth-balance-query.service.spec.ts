import type { DrizzleService } from '@db/core'
import { GrowthBalanceQueryService } from './growth-balance-query.service'
import { GrowthAssetTypeEnum } from './growth-ledger.constant'

function createDrizzleStub(
  rows: Array<{ userId: number, assetType: number, balance: number }> = [],
) {
  const selectChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(rows),
  }

  return {
    db: {
      select: jest.fn().mockReturnValue(selectChain),
    },
    schema: {
      userAssetBalance: {
        userId: 'userId',
        assetType: 'assetType',
        assetKey: 'assetKey',
        balance: 'balance',
      },
    },
  } as unknown as DrizzleService
}

describe('growthBalanceQueryService', () => {
  it('returns empty map without querying when userIds is empty', async () => {
    const drizzle = createDrizzleStub()
    const service = new GrowthBalanceQueryService(drizzle)

    const result = await service.getUserGrowthSnapshotMap([])

    expect(result.size).toBe(0)
    expect(drizzle.db.select).not.toHaveBeenCalled()
  })

  it('reads balances in one batch and fills missing entries with zero', async () => {
    const drizzle = createDrizzleStub([
      {
        userId: 7,
        assetType: GrowthAssetTypeEnum.POINTS,
        balance: 18,
      },
      {
        userId: 7,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        balance: 31,
      },
      {
        userId: 9,
        assetType: GrowthAssetTypeEnum.POINTS,
        balance: 5,
      },
    ])
    const service = new GrowthBalanceQueryService(drizzle)

    const result = await service.getUserGrowthSnapshotMap([7, 7, 9, 10])

    expect(drizzle.db.select).toHaveBeenCalledTimes(1)
    expect(result.get(7)).toEqual({ points: 18, experience: 31 })
    expect(result.get(9)).toEqual({ points: 5, experience: 0 })
    expect(result.get(10)).toEqual({ points: 0, experience: 0 })
  })
})
