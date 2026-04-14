import type { ContentPermissionService } from '@libs/content/permission/content-permission.service'
import {
  PaymentMethodEnum,
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from './purchase.constant'
import { PurchaseService } from './purchase.service'

describe('purchase service', () => {
  function createService() {
    const record = {
      id: 88,
      targetType: PurchaseTargetTypeEnum.COMIC_CHAPTER,
      targetId: 101,
      userId: 9,
      status: PurchaseStatusEnum.SUCCESS,
      paymentMethod: PaymentMethodEnum.POINTS,
      outTradeNo: 'trade-no',
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
      updatedAt: new Date('2026-04-12T10:00:00.000Z'),
    }
    const values = jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([record]),
    }))
    const insert = jest.fn(() => ({
      values,
    }))
    const tx = {
      insert,
    }
    const drizzle = {
      db: {
        transaction: jest.fn(
          async (runner: (transaction: typeof tx) => Promise<unknown>) =>
            runner(tx),
        ),
      },
      schema: {
        userPurchaseRecord: {},
      },
      isUniqueViolation: jest.fn().mockReturnValue(false),
      withErrorHandling: jest.fn(async (runner: () => Promise<unknown>) =>
        runner(),
      ),
    }
    const growthLedgerService = {
      applyDelta: jest.fn().mockResolvedValue({
        success: true,
        duplicated: false,
      }),
    }
    const contentPermissionService = {
      resolvePurchasePricing: jest.fn().mockResolvedValue({
        originalPrice: 25,
        payableRate: 0.9,
        payablePrice: 23,
        discountAmount: 2,
      }),
    } as unknown as jest.Mocked<ContentPermissionService>

    const service = new PurchaseService(
      growthLedgerService as never,
      drizzle as never,
      contentPermissionService,
    )

    const resolver = {
      targetType: PurchaseTargetTypeEnum.COMIC_CHAPTER,
      ensurePurchaseable: jest.fn().mockResolvedValue({
        originalPrice: 25,
      }),
      applyCountDelta: jest.fn().mockResolvedValue(undefined),
    }
    service.registerResolver(resolver as never)

    return {
      service,
      resolver,
      values,
      growthLedgerService,
      contentPermissionService,
    }
  }

  it('purchaseTarget 会冻结原价与折扣快照并按实付积分扣减', async () => {
    const {
      service,
      resolver,
      values,
      growthLedgerService,
      contentPermissionService,
    } = createService()

    const result = await service.purchaseTarget({
      userId: 9,
      targetType: PurchaseTargetTypeEnum.COMIC_CHAPTER,
      targetId: 101,
      paymentMethod: PaymentMethodEnum.POINTS,
      outTradeNo: 'trade-no',
    })

    expect(resolver.ensurePurchaseable).toHaveBeenCalledWith(101)
    expect(
      contentPermissionService.resolvePurchasePricing,
    ).toHaveBeenCalledWith(25, 9)
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: PurchaseTargetTypeEnum.COMIC_CHAPTER,
        targetId: 101,
        userId: 9,
        originalPrice: 25,
        paidPrice: 23,
        payableRate: '0.90',
      }),
    )
    expect(growthLedgerService.applyDelta).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        amount: 23,
      }),
    )
    expect(result).toMatchObject({
      id: 88,
      targetType: PurchaseTargetTypeEnum.COMIC_CHAPTER,
      targetId: 101,
      purchasePricing: {
        originalPrice: 25,
        payableRate: 0.9,
        payablePrice: 23,
        discountAmount: 2,
      },
    })
  })
})
