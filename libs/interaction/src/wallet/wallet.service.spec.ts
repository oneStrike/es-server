/// <reference types="jest" />

import * as schema from '@db/schema'
import { GrowthLedgerActionEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import { BusinessException } from '@libs/platform/exceptions'
import { WalletService } from './wallet.service'
import { READING_COIN_ASSET_KEY } from './wallet.constant'

function createSelectChain(rows: unknown[]) {
  const chain = {
    from: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    offset: jest.fn(async () => rows),
    orderBy: jest.fn(() => chain),
    where: jest.fn(() => chain),
  }

  return chain
}

describe('WalletService domain split contract', () => {
  it('spends reading coin through the wallet owner for purchase transactions', async () => {
    const growthLedgerService = {
      applyDelta: jest.fn(() => Promise.resolve({ success: true })),
    }
    const service = new WalletService(
      {} as any,
      growthLedgerService as any,
      {} as any,
    )
    const tx = {}

    await service.consumeForPurchase(tx as any, {
      amount: 27,
      outTradeNo: 'seed-order',
      paymentMethod: 1,
      purchaseId: 11,
      targetId: 22,
      targetType: 1,
      userId: 33,
    })

    expect(growthLedgerService.applyDelta).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 2,
        amount: 27,
        assetKey: READING_COIN_ASSET_KEY,
        assetType: 4,
        bizKey: 'purchase:11:consume',
        source: 'purchase',
      }),
    )
  })

  it('maps insufficient balance from ledger rejection to a business exception', async () => {
    const growthLedgerService = {
      applyDelta: jest.fn(() =>
        Promise.resolve({ reason: 'insufficient_balance', success: false }),
      ),
    }
    const service = new WalletService(
      {} as any,
      growthLedgerService as any,
      {} as any,
    )

    await expect(
      service.consumeForPurchase({} as any, {
        amount: 99,
        paymentMethod: 1,
        purchaseId: 1,
        targetId: 2,
        targetType: 1,
        userId: 3,
      }),
    ).rejects.toBeInstanceOf(BusinessException)
  })
})

describe('WalletService app page contract', () => {
  it('returns wallet ledger page with offset pagination contract', async () => {
    const rows = [
      {
        id: 101,
        delta: 100,
        beforeValue: 900,
        afterValue: 1000,
        source: 'payment_order',
        remark: '充值',
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
      {
        id: 100,
        delta: -27,
        beforeValue: 1000,
        afterValue: 973,
        source: 'purchase',
        remark: null,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ]
    const pageQuery = {
      limit: 1,
      offset: 1,
      pageIndex: 2,
      pageSize: 1,
    }
    const selectChain = createSelectChain(rows)
    const drizzle = {
      buildPage: jest.fn(() => pageQuery),
      buildPageParams: jest.fn(() => ({
        page: pageQuery,
        order: {
          orderBySql: ['created_at_desc'],
        },
        dateRange: undefined,
      })),
      db: {
        $count: jest.fn(async () => 2),
        select: jest.fn(() => selectChain),
      },
      schema,
    }
    const service = new WalletService(drizzle as any, {} as any, {} as any)

    const page = await service.getWalletLedgerPage(33, {
      pageIndex: 2,
      pageSize: 1,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 2, pageSize: 1 }),
      expect.any(Object),
    )
    expect(selectChain.orderBy).toHaveBeenCalled()
    expect(selectChain.limit).toHaveBeenCalledWith(pageQuery.limit)
    expect(selectChain.offset).toHaveBeenCalledWith(pageQuery.offset)
    expect(drizzle.db.$count).toHaveBeenCalledWith(
      schema.growthLedgerRecord,
      expect.anything(),
    )
    expect(page).toMatchObject({
      total: 2,
      pageIndex: 2,
      pageSize: 1,
      list: [
        {
          id: 101,
          action: GrowthLedgerActionEnum.GRANT,
          amount: 100,
        },
        {
          id: 100,
          action: GrowthLedgerActionEnum.CONSUME,
          amount: 27,
        },
      ],
    })
    expect(page.list.map((item) => item.id)).toEqual([101, 100])
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('returns empty wallet ledger page', async () => {
    const pageQuery = {
      limit: 1,
      offset: 1,
      pageIndex: 2,
      pageSize: 1,
    }
    const selectChain = createSelectChain([])
    const drizzle = {
      buildPage: jest.fn(() => pageQuery),
      buildPageParams: jest.fn(() => ({
        page: pageQuery,
        order: {
          orderBySql: ['created_at_desc'],
        },
        dateRange: undefined,
      })),
      db: {
        $count: jest.fn(async () => 2),
        select: jest.fn(() => selectChain),
      },
      schema,
    }
    const service = new WalletService(drizzle as any, {} as any, {} as any)

    const page = await service.getWalletLedgerPage(33, {
      pageIndex: 2,
      pageSize: 1,
    })

    expect(page).toEqual({
      list: [],
      total: 2,
      pageIndex: 2,
      pageSize: 1,
    })
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })
})
