/// <reference types="jest" />

import * as schema from '@db/schema'
import {
  ContentTypeEnum,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { sql } from 'drizzle-orm'
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
      buildPage: jest.fn(() => ({
        limit: 20,
        offset: 0,
        pageIndex: 1,
        pageSize: 20,
      })),
      buildPageParams: jest.fn(() => ({
        page: {
          limit: 20,
          offset: 0,
          pageIndex: 1,
          pageSize: 20,
        },
        order: {
          orderByClause: sql.raw(
            'MAX(COALESCE(upr.created_at, uce.created_at)) DESC, wc.work_id DESC',
          ),
          orderBySql: [],
        },
        dateRange: undefined,
      })),
      buildAllowlistedOrderBy: jest.fn(() => ({
        orderByClause: sql.raw(
          'MAX(COALESCE(upr.created_at, uce.created_at)) DESC, wc.work_id DESC',
        ),
      })),
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

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 33,
        pageSize: 20,
      }),
      expect.any(Object),
    )
    const sqlText = flattenSqlText(executedQueries[0]).replace(/\s+/g, ' ')
    expect(sqlText).toContain(
      'MAX(COALESCE(upr.created_at, uce.created_at)) AS "lastPurchasedAt"',
    )
    expect(sqlText).toContain(
      'ORDER BY MAX(COALESCE(upr.created_at, uce.created_at)) DESC, wc.work_id DESC',
    )
    expect(sqlText).toContain('LIMIT')
    expect(sqlText).toContain('OFFSET')
    expect(sqlText).not.toContain('COALESCE(upr.created_at, uce.created_at) >=')
  })

  it('uses offset pagination for purchased work chapters', async () => {
    const executedQueries: unknown[] = []
    const drizzle = {
      schema,
      db: {
        execute: jest.fn((query: unknown) => {
          executedQueries.push(query)
          if (executedQueries.length > 1) {
            return Promise.resolve({ rows: [{ total: 2n }] })
          }

          return Promise.resolve({
            rows: [
              {
                id: 101,
                targetType: 1,
                targetId: 201,
                userId: 33,
                originalPrice: 30,
                paidPrice: 27,
                payableRate: '0.90',
                status: 1,
                paymentMethod: 1,
                outTradeNo: null,
                discountAmount: 3,
                couponInstanceId: 44,
                discountSource: 1,
                createdAt: new Date('2026-05-07T08:00:00.000Z'),
                updatedAt: new Date('2026-05-07T08:01:00.000Z'),
                workCover: null,
                chapterId: 201,
                chapterWorkId: 44,
                chapterWorkType: 1,
                chapterTitle: '第一章',
                chapterSubtitle: null,
                chapterCover: null,
                chapterSortOrder: 1,
                chapterIsPublished: true,
                chapterPublishAt: null,
              },
            ],
          })
        }),
      },
      buildPage: jest.fn(() => ({
        limit: 1,
        offset: 1,
        pageIndex: 2,
        pageSize: 1,
      })),
      buildPageParams: jest.fn(() => ({
        page: {
          limit: 1,
          offset: 1,
          pageIndex: 2,
          pageSize: 1,
        },
        order: {
          orderByClause: sql.raw(
            'COALESCE(upr.created_at, uce.created_at) DESC, COALESCE(upr.id, uce.id) DESC',
          ),
          orderBySql: [],
        },
        dateRange: undefined,
      })),
      buildAllowlistedOrderBy: jest.fn(() => ({
        orderByClause: sql.raw(
          'COALESCE(upr.created_at, uce.created_at) DESC, COALESCE(upr.id, uce.id) DESC',
        ),
      })),
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
      pageIndex: 2,
      pageSize: 1,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 33,
        workId: 44,
        pageIndex: 2,
        pageSize: 1,
      }),
      expect.any(Object),
    )
    expect(page).toMatchObject({
      total: 2,
      pageIndex: 2,
      pageSize: 1,
      list: [
        {
          id: 101,
          targetType: 1,
          targetId: 201,
          userId: 33,
          purchasePricing: {
            originalPrice: 30,
            payableRate: 0.9,
            payablePrice: 27,
            discountAmount: 3,
          },
          status: 1,
          paymentMethod: 1,
          discountAmount: 3,
          couponInstanceId: 44,
          discountSource: 1,
          chapter: {
            id: 201,
            workId: 44,
            workType: 1,
            title: '第一章',
            subtitle: null,
            cover: null,
            sortOrder: 1,
            isPublished: true,
            publishAt: null,
          },
        },
      ],
    })
    const sqlText = flattenSqlText(executedQueries[0]).replace(/\s+/g, ' ')
    expect(sqlText).toContain(
      'ORDER BY COALESCE(upr.created_at, uce.created_at) DESC, COALESCE(upr.id, uce.id) DESC',
    )
    expect(sqlText).toContain('LIMIT')
    expect(sqlText).toContain('OFFSET')
  })
})
