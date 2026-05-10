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
    ) as PurchaseService

    await service.getPurchasedWorks({
      userId: 33,
      pageIndex: 1,
      pageSize: 20,
      startDate: '2026-05-01',
      endDate: '2026-05-07',
    })

    const sqlText = flattenSqlText(executedQueries[0]).replace(/\s+/g, ' ')
    expect(sqlText).toContain(
      'MAX(COALESCE(upr.created_at, uce.created_at)) AS "lastPurchasedAt"',
    )
    expect(sqlText).toContain('COALESCE(upr.created_at, uce.created_at) >=')
    expect(sqlText).toContain(
      'ORDER BY MAX(COALESCE(upr.created_at, uce.created_at)) DESC',
    )
  })
})
