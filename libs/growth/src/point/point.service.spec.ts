/// <reference types="jest" />

import { appUser, growthLedgerRecord, userAssetBalance } from '@db/schema'
import { GrowthAssetTypeEnum } from '../growth-ledger/growth-ledger.constant'
import { UserPointService } from './point.service'

describe('UserPointService app record page contract', () => {
  it('returns app point records as ApiPage-style page without cursor output', async () => {
    const { drizzle, query, service } = createPointService([
      buildLedgerRecord(),
    ])
    drizzle.buildPageParams.mockReturnValue({
      page: {
        limit: 10,
        offset: 10,
        pageIndex: 2,
        pageSize: 10,
      },
      order: {
        orderBySql: ['id_desc'],
      },
      dateRange: undefined,
    })

    const result = await service.getAppPointRecordPage({
      pageIndex: 2,
      pageSize: 10,
      userId: 7,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 2, pageSize: 10, userId: 7 }),
      expect.any(Object),
    )
    expect(query.limit).toHaveBeenCalledWith(10)
    expect(query.offset).toHaveBeenCalledWith(10)
    expect(result).toMatchObject({
      pageIndex: 2,
      pageSize: 10,
      total: 1,
    })
    expect(result.list[0]).toMatchObject({
      id: 1,
      points: 5,
      userId: 7,
    })
    expect(result).not.toHaveProperty('hasMore')
    expect(result).not.toHaveProperty('nextCursor')
  })
})

function createPointService(records: ReturnType<typeof buildLedgerRecord>[]) {
  const query = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue(records),
  }
  const db = {
    select: jest.fn(() => query),
    $count: jest.fn().mockResolvedValue(records.length),
    query: {
      appUser: { findFirst: jest.fn() },
      growthLedgerRecord: { findFirst: jest.fn() },
      userAssetBalance: { findFirst: jest.fn() },
    },
  }
  const drizzle = {
    db,
    schema: {
      appUser,
      growthLedgerRecord,
      userAssetBalance,
    },
    buildPage: jest.fn(() => ({
      limit: 20,
      offset: 0,
      pageIndex: 1,
      pageSize: 20,
    })),
    buildOrderBy: jest.fn(() => ({ orderBySql: ['id_desc'] })),
    buildPageParams: jest.fn(() => ({
      page: {
        limit: 20,
        offset: 0,
        pageIndex: 1,
        pageSize: 20,
      },
      order: {
        orderBySql: ['id_desc'],
      },
      dateRange: undefined,
    })),
  }
  const growthLedgerService = {
    sanitizePublicContext: jest.fn(() => null),
  }

  return {
    db,
    drizzle,
    query,
    service: new UserPointService(
      drizzle as never,
      growthLedgerService as never,
    ),
  }
}

function buildLedgerRecord() {
  return {
    afterValue: 15,
    assetType: GrowthAssetTypeEnum.POINTS,
    beforeValue: 10,
    bizKey: 'point:biz',
    context: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    delta: 5,
    id: 1,
    remark: null,
    ruleId: null,
    ruleType: null,
    source: 'growth_rule',
    targetId: null,
    targetType: null,
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    userId: 7,
  }
}
