/// <reference types="jest" />

import * as schema from '@db/schema'
import {
  ContentTypeEnum,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { PurchaseService } from './purchase.service'
import { PaymentMethodEnum, PurchaseTargetTypeEnum } from './purchase.constant'

function createInsertReturningBuilder<TResult>(result: TResult[]) {
  return {
    values: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve(result)),
    })),
  }
}

function flattenSqlText(input: unknown): string {
  if (!input) {
    return ''
  }
  if (typeof input === 'string') {
    return input
  }
  if (typeof input !== 'object') {
    return ''
  }
  if ('value' in input && Array.isArray(input.value)) {
    return input.value.join('')
  }
  if ('queryChunks' in input && Array.isArray(input.queryChunks)) {
    return input.queryChunks.map(flattenSqlText).join('')
  }
  return ''
}

describe('PurchaseService domain split contract', () => {
  it('writes discount snapshot, consumes currency, and grants purchase entitlement in one transaction', async () => {
    const tx = {
      insert: jest.fn(() =>
        createInsertReturningBuilder([
          {
            id: 11,
            targetType: PurchaseTargetTypeEnum.COMIC_CHAPTER,
            targetId: 22,
            userId: 33,
            originalPrice: 30,
            paidPrice: 27,
            payableRate: '0.90',
            discountAmount: 3,
            couponInstanceId: 44,
            discountSource: 1,
            status: 1,
            paymentMethod: PaymentMethodEnum.CURRENCY,
            outTradeNo: 'seed-order',
            createdAt: new Date('2026-05-06T00:00:00.000Z'),
            updatedAt: new Date('2026-05-06T00:00:00.000Z'),
          },
        ]),
      ),
    }
    const drizzle = {
      schema,
      db: {
        transaction: jest.fn((callback: (runner: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
      isUniqueViolation: jest.fn(() => false),
      withErrorHandling: jest.fn(),
    }
    const contentPermissionService = {
      resolveChapterPermission: jest.fn(() =>
        Promise.resolve({
          workType: ContentTypeEnum.COMIC,
          viewRule: WorkViewPermissionEnum.PURCHASE,
          purchasePricing: {
            originalPrice: 30,
            payableRate: 1,
            payablePrice: 30,
            discountAmount: 0,
          },
        }),
      ),
      resolvePurchasePricing: jest.fn(() =>
        Promise.resolve({
          originalPrice: 30,
          payableRate: 1,
          payablePrice: 30,
          discountAmount: 0,
        }),
      ),
    }
    const contentEntitlementService = {
      grantPurchaseEntitlement: jest.fn(),
    }
    const workCounterService = {
      updateWorkChapterPurchaseCount: jest.fn(),
    }
    const userLevelRuleService = {
      resolveLevelPurchasePricingInTx: jest.fn(() =>
        Promise.resolve({
          originalPrice: 30,
          levelPayableRate: '1.00',
          levelPayablePrice: 30,
          levelDiscountAmount: 0,
        }),
      ),
    }
    const couponService = {
      reserveDiscountCoupon: jest.fn(() =>
        Promise.resolve({
          paidPrice: 27,
          discountAmount: 3,
          couponInstanceId: 44,
          redemptionRecordId: 55,
          discountSource: 1,
        }),
      ),
    }
    const walletService = {
      consumeForPurchase: jest.fn(() => Promise.resolve({ success: true })),
    }
    const service = new (PurchaseService as any)(
      drizzle,
      contentPermissionService,
      contentEntitlementService,
      workCounterService,
      userLevelRuleService,
      couponService,
      walletService,
    ) as PurchaseService

    const result = await service.purchaseChapter({
      userId: 33,
      targetType: PurchaseTargetTypeEnum.COMIC_CHAPTER,
      targetId: 22,
      paymentMethod: PaymentMethodEnum.CURRENCY,
      outTradeNo: 'seed-order',
      couponInstanceId: 44,
    })

    expect(couponService.reserveDiscountCoupon).toHaveBeenCalledWith(tx, {
      userId: 33,
      couponInstanceId: 44,
      targetType: 1,
      targetId: 22,
      originalPrice: 30,
    })
    expect(tx.insert).toHaveBeenCalledWith(schema.userPurchaseRecord)
    expect(walletService.consumeForPurchase).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        amount: 27,
        purchaseId: 11,
        paymentMethod: PaymentMethodEnum.CURRENCY,
      }),
    )
    expect(
      contentEntitlementService.grantPurchaseEntitlement,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: 33,
        targetType: 1,
        targetId: 22,
        sourceId: 11,
        grantSnapshot: expect.objectContaining({
          discountAmount: 3,
          couponInstanceId: 44,
        }),
      }),
    )
    expect(result.purchasePricing?.payablePrice).toBe(27)
    expect(result.discountAmount).toBe(3)
    expect(result.couponInstanceId).toBe(44)
  })

  it('uses entitlement createdAt as the purchased work timestamp when purchase rows are absent', async () => {
    const executedQueries: unknown[] = []
    const drizzle = {
      schema,
      db: {
        execute: jest.fn((query: unknown) => {
          executedQueries.push(query)
          return Promise.resolve({ rows: [] })
        }),
      },
      buildPage: jest.fn(() => ({ limit: 20, offset: 0 })),
      isUniqueViolation: jest.fn(() => false),
      withErrorHandling: jest.fn(),
    }
    const service = new (PurchaseService as any)(
      drizzle,
      {},
      {},
      {},
      {},
      {},
      {},
    ) as PurchaseService

    await service.getPurchasedWorks({
      userId: 33,
      pageSize: 20,
    })

    const sqlText = flattenSqlText(executedQueries[0]).replace(/\s+/g, ' ')
    expect(sqlText).toContain(
      'MAX(COALESCE(upr.created_at, uce.created_at)) AS "lastPurchasedAt"',
    )
    expect(sqlText).toContain(
      'ORDER BY MAX(COALESCE(upr.created_at, uce.created_at)) DESC, wc.work_id DESC',
    )
    expect(sqlText).not.toContain(
      'COALESCE(upr.created_at, uce.created_at) >=',
    )
  })

  it('rejects app purchased work date filters after cursor-only contract', async () => {
    const drizzle = {
      schema,
      db: {
        execute: jest.fn(() => Promise.resolve({ rows: [] })),
      },
      buildPage: jest.fn(() => ({ limit: 20, offset: 0 })),
      isUniqueViolation: jest.fn(() => false),
      withErrorHandling: jest.fn(),
    }
    const service = new (PurchaseService as any)(
      drizzle,
      {},
      {},
      {},
      {},
      {},
      {},
    ) as PurchaseService

    await expect(
      service.getPurchasedWorks({
        userId: 33,
        pageSize: 20,
        startDate: '2026-05-01',
      } as never),
    ).rejects.toThrow('startDate')
    expect(drizzle.db.execute).not.toHaveBeenCalled()
  })

  it('rejects app purchased chapter date filters after cursor-only contract', async () => {
    const drizzle = {
      schema,
      db: {
        execute: jest.fn(() => Promise.resolve({ rows: [] })),
      },
      buildPage: jest.fn(() => ({ limit: 20, offset: 0 })),
      isUniqueViolation: jest.fn(() => false),
      withErrorHandling: jest.fn(),
    }
    const service = new (PurchaseService as any)(
      drizzle,
      {},
      {},
      {},
      {},
      {},
      {},
    ) as PurchaseService

    await expect(
      service.getPurchasedWorkChapters({
        userId: 33,
        workId: 44,
        pageSize: 20,
        endDate: '2026-05-07',
      } as never),
    ).rejects.toThrow('endDate')
    expect(drizzle.db.execute).not.toHaveBeenCalled()
  })

  it('uses purchase tuple cursor for purchased work chapters', async () => {
    const executedQueries: unknown[] = []
    const drizzle = {
      schema,
      db: {
        execute: jest.fn((query: unknown) => {
          executedQueries.push(query)
          return Promise.resolve({
            rows: [
              {
                id: 101,
                targetType: 1,
                targetId: 201,
                purchaseRecordId: 101,
                grantSource: 1,
                purchaseStatus: 1,
                createdAt: new Date('2026-05-07T08:00:00.000Z'),
                entitlementCreatedAt: new Date('2026-05-07T08:00:00.000Z'),
                workId: 44,
                workName: '测试作品',
                workType: 1,
                workCover: null,
                chapterId: 201,
                chapterWorkId: 44,
                chapterTitle: '第一章',
                chapterSortOrder: 1,
                chapterIsPublished: true,
                chapterPublishAt: null,
              },
              {
                id: 100,
                targetType: 1,
                targetId: 202,
                purchaseRecordId: 100,
                grantSource: 1,
                purchaseStatus: 1,
                createdAt: new Date('2026-05-07T07:00:00.000Z'),
                entitlementCreatedAt: new Date('2026-05-07T07:00:00.000Z'),
                workId: 44,
                workName: '测试作品',
                workType: 1,
                workCover: null,
                chapterId: 202,
                chapterWorkId: 44,
                chapterTitle: '第二章',
                chapterSortOrder: 2,
                chapterIsPublished: true,
                chapterPublishAt: null,
              },
            ],
          })
        }),
      },
      buildPage: jest.fn(() => ({ limit: 1, offset: 0 })),
      isUniqueViolation: jest.fn(() => false),
      withErrorHandling: jest.fn(),
    }
    const service = new (PurchaseService as any)(
      drizzle,
      {},
      {},
      {},
      {},
      {},
      {},
    ) as PurchaseService

    const page = await service.getPurchasedWorkChapters({
      userId: 33,
      workId: 44,
      pageSize: 1,
    })

    expect(page.list).toHaveLength(1)
    expect(page.hasMore).toBe(true)
    expect(page.nextCursor).toBeTruthy()
    const cursor = JSON.parse(
      Buffer.from(page.nextCursor!, 'base64url').toString('utf8'),
    )
    expect(cursor).toEqual({
      createdAt: '2026-05-07T08:00:00.000Z',
      id: 101,
    })
    const sqlText = flattenSqlText(executedQueries[0]).replace(/\s+/g, ' ')
    expect(sqlText).toContain(
      'ORDER BY COALESCE(upr.created_at, uce.created_at) DESC, COALESCE(upr.id, uce.id) DESC',
    )
  })
})
